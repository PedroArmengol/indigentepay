import { budgetSummary, getStore, newId, now } from "./core";
import { createStaticQr, findPayment, listTransactions, paidCents, peyEnabled } from "./pey";
import type { Fund, RecipientRecord } from "./types";

/**
 * Pago directo a un receptor: el cobro CoDi lleva el código de su gafete, así que
 * al confirmarse se abona a su subcuenta. Si la persona recibe en su banco, el
 * abono se le deposita de inmediato (simulado).
 */
export async function settleDirect(fund: Fund): Promise<"ok" | "already" | "missing"> {
  const store = await getStore();
  const person = fund.target ? await store.getRecipient(fund.target) : null;
  if (!fund.target || !person) return "missing";
  const tx = {
    id: newId("t"), ts: now(), type: "donation" as const, amount: fund.amount, code: person.code, alias: person.alias,
    donorName: fund.donorName || "Donante CoDi", concept: "Pago directo CoDi",
  };
  const result = await store.confirmDirect(fund.id, tx);
  if (result === "ok" && person.payout === "clabe" && person.clabe) {
    await store.redeem(person.code, fund.amount, {
      id: newId("t"), ts: now(), type: "payout", amount: fund.amount, code: person.code, alias: person.alias,
      merchant: `Depósito a ${person.bank ?? "su banco"} ••••${person.clabe.slice(-4)}`,
    }, "payout");
  }
  return result;
}

/** Estado de un pago directo; si sigue pendiente, pregunta a Pey si ya llegó. */
export async function directStatus(id: string) {
  const store = await getStore();
  let fund = await store.getFund(id);
  if (!fund || !fund.target) return null;
  if (fund.status === "PENDING") {
    try {
      if (await findPayment(fund)) {
        await settleDirect(fund);
        fund = (await store.getFund(id)) ?? fund;
      }
    } catch (err) {
      console.error("pey", err);
    }
  }
  const person = await store.getRecipient(fund.target!);
  const donor = fund.donorId ? await store.getDonor(fund.donorId) : null;
  const summary = donor ? budgetSummary(await store.donorTxs(donor.id, 300), donor.budget) : null;
  return {
    id: fund.id, amount: fund.amount, status: fund.status, code: fund.target, alias: person?.alias,
    deposited: fund.status === "PAID" && person?.payout === "clabe", summary,
  };
}

// ------------------------------------------------- QR fijo del gafete

/** Crea (una vez) el QR CoDi fijo de la persona. Si Pey falla, el gafete sigue funcionando con su liga. */
export async function ensureStaticQr(person: RecipientRecord): Promise<string | undefined> {
  if (person.codiQr || !peyEnabled()) return person.codiQr;
  try {
    const qr = await createStaticQr(person.code, person.alias, String(now() % 10_000_000));
    if (!qr.qrString) return undefined;
    await (await getStore()).setRecipientQr(person.code, qr.id, qr.qrString);
    return qr.qrString;
  } catch (err) {
    console.error("pey", err);
    return undefined;
  }
}

/** Abona al gafete un pago hecho a su QR fijo (una sola vez por transacción de Pey). */
export async function creditStatic(code: string, cents: number, payId: string) {
  const store = await getStore();
  const person = await store.getRecipient(code);
  if (!person || cents <= 0) return "missing" as const;
  const result = await store.creditRecipient(code, cents, {
    id: newId("t"), ts: now(), type: "donation", amount: cents, code, alias: person.alias,
    donorName: "alguien, con CoDi", concept: "Pago al QR del gafete",
  }, payId);
  if (result === "ok" && person.payout === "clabe" && person.clabe) {
    await store.redeem(code, cents, {
      id: newId("t"), ts: now(), type: "payout", amount: cents, code, alias: person.alias,
      merchant: `Depósito a ${person.bank ?? "su banco"} ••••${person.clabe.slice(-4)}`,
    }, "payout");
  }
  return result;
}

/**
 * Revisa en Pey los pagos recibidos en los QR fijos y los abona a cada gafete.
 * Se llama al consultar saldos y estadísticas; un candado evita hacerlo más de una vez cada pocos segundos.
 */
export async function syncStaticPayments(): Promise<number> {
  if (!peyEnabled()) return 0;
  const store = await getStore();
  try {
    if (!(await store.lock("sync", 3))) return 0;
    const map = await store.qrMap();
    if (Object.keys(map).length === 0) return 0;
    const [txs, seen] = await Promise.all([listTransactions(), store.paidTxIds()]);
    let credited = 0;
    for (const tx of txs.reverse()) {
      const id = String(tx.id ?? "");
      // El pago se liga al gafete por el id de su QR fijo o, si Pey no lo trae, por el receptor en los metadatos.
      // Los cobros con orderId son fondeos o pagos directos: esos se confirman por su propia ruta.
      const meta = (tx.metadata ?? {}) as Record<string, unknown>;
      const ext = (meta.externalMetadata ?? meta) as Record<string, unknown>;
      const porMetadatos = !ext.orderId && ext.recipient ? String(ext.recipient) : undefined;
      const code = map[String(tx.payableId ?? "")] ?? porMetadatos;
      if (!id || !code || tx.status !== "PAID" || seen.has(id)) continue;
      if ((await creditStatic(code, paidCents(tx), id)) === "ok") credited += 1;
    }
    return credited;
  } catch (err) {
    console.error("pey", err);
    return 0;
  }
}
