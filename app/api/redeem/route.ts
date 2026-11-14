import { fail, ok, readBody } from "@/lib/api";
import { LIMITS, clean, getStore, hashPin, newId, normalizeCode, now, toCents } from "@/lib/core";

// Cobro en comercio aliado: la persona paga con su gafete y su NIP
export async function POST(req: Request) {
  const body = await readBody(req);
  const code = normalizeCode(String(body.code ?? ""));
  const amount = toCents(body.amount);
  const merchant = clean(body.merchant, 40);
  const concept = clean(body.concept, 60);
  if (merchant.length < 2) return fail(400, "Escribe el nombre del comercio.");
  if (!amount || amount < LIMITS.redeemMin || amount > LIMITS.redeemMax) return fail(400, "El cobro debe ser entre $1 y $2,000.");

  const store = await getStore();
  const person = await store.getRecipient(code);
  if (!person) return fail(404, "Este gafete no existe.");
  if ((await store.pinFails(code)) >= LIMITS.pinTries) return fail(429, "Demasiados intentos. El gafete se desbloquea en 10 minutos.");
  if (hashPin(code, String(body.pin ?? "")) !== person.pinHash) {
    const tries = await store.pinFail(code);
    return fail(403, `NIP incorrecto. Quedan ${Math.max(0, LIMITS.pinTries - tries)} intentos.`);
  }
  await store.pinReset(code);

  const tx = { id: newId("t"), ts: now(), type: "redeem" as const, amount, code, alias: person.alias, merchant, concept };
  const result = await store.redeem(code, amount, tx);
  if (!result.ok) {
    if (result.reason === "funds") return fail(402, "El saldo del gafete no alcanza para este cobro.", { balance: person.balance });
    return fail(404, "No pudimos completar el cobro.");
  }
  return ok({ tx, balance: result.balance, alias: person.alias });
}
