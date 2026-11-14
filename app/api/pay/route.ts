import { fail, ok, readBody, walletFrom } from "@/lib/api";
import { LIMITS, getStore, newId, normalizeCode, now, toCents } from "@/lib/core";
import { createCodiPush, createCodiQr, peyEnabled } from "@/lib/pey";
import type { Fund } from "@/lib/types";

// Pago directo a un receptor con CoDi: el cobro va referenciado a su gafete.
export async function POST(req: Request) {
  if (!peyEnabled()) return fail(400, "El pago directo con CoDi no está activado. Da desde tu wallet.");
  const body = await readBody(req);
  const code = normalizeCode(String(body.code ?? ""));
  const amount = toCents(body.amount);
  if (!amount || amount < LIMITS.donateMin || amount > LIMITS.donateMax) return fail(400, "Puedes dar entre $1 y $1,000 por donativo.");
  const store = await getStore();
  const person = await store.getRecipient(code);
  if (!person) return fail(404, "Este gafete no existe.");

  // Si quien paga tiene wallet, el donativo también cuenta para su presupuesto del mes.
  const donor = await walletFrom(req);
  const fund: Fund = {
    id: newId("f"), donorId: donor?.id ?? "", donorName: donor?.name ?? "", target: code, amount,
    status: "PENDING", provider: "pey", createdAt: now(),
  };
  const destino = { concept: `Donativo ${person.alias}`, recipient: code };
  const numRef = String(now() % 10_000_000);
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  try {
    if (body.method === "pn") {
      if (!/^\d{10}$/.test(phone)) return fail(400, "Escribe tu celular a 10 dígitos.");
      const push = await createCodiPush(amount, fund.id, numRef, phone, destino);
      fund.method = "pn";
      fund.providerRef = push.transactionId;
    } else {
      const qr = await createCodiQr(amount, fund.id, numRef, destino);
      fund.method = "qr";
      fund.providerRef = qr.id;
      fund.qrImage = qr.qrImage;
      fund.qrString = qr.qrString;
    }
  } catch (err) {
    console.error("pey", err);
    return fail(502, "No pudimos generar el cobro CoDi. Intenta de nuevo.", { detail: String(err).slice(0, 200) });
  }
  await store.createFund(fund);
  return ok({ pay: { id: fund.id, amount, status: fund.status, method: fund.method, qrImage: fund.qrImage, qrString: fund.qrString, code } }, 201);
}
