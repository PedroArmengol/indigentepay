import { fail, ok, readBody, walletFrom } from "@/lib/api";
import { LIMITS, budgetSummary, getStore, newId, normalizeCode, now, toCents } from "@/lib/core";

// Donar: mueve saldo de la wallet al gafete
export async function POST(req: Request) {
  const donor = await walletFrom(req);
  if (!donor) return fail(401, "Abre tu wallet para poder donar.");
  const body = await readBody(req);
  const code = normalizeCode(String(body.code ?? ""));
  const amount = toCents(body.amount);
  if (!amount || amount < LIMITS.donateMin || amount > LIMITS.donateMax) {
    return fail(400, "Puedes dar entre $1 y $1,000 por donativo.");
  }
  const store = await getStore();
  const person = await store.getRecipient(code);
  if (!person) return fail(404, "Este gafete no existe.");

  const tx = { id: newId("t"), ts: now(), type: "donation" as const, amount, code, alias: person.alias, donorName: donor.name };
  const result = await store.donate(donor.id, code, amount, tx);
  if (!result.ok) {
    if (result.reason === "funds") return fail(402, "No te alcanza el saldo. Fondea tu wallet y vuelve a intentar.", { balance: donor.balance });
    return fail(404, "No pudimos completar el donativo.");
  }
  const txs = await store.donorTxs(donor.id, 300);
  return ok({ tx, balance: result.balance, summary: budgetSummary(txs, donor.budget) });
}
