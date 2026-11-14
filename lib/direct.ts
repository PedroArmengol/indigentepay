import { budgetSummary, getStore, newId, now } from "./core";
import { findPayment } from "./pey";
import type { Fund } from "./types";

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
