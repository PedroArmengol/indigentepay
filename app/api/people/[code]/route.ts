import { fail, ok, readBody } from "@/lib/api";
import { LIMITS, getStore, hashPin, normalizeCode, publicRecipient } from "@/lib/core";

// Perfil público: lo que ve quien escanea el gafete (sin saldo)
export async function GET(_req: Request, ctx: RouteContext<"/api/people/[code]">) {
  const { code } = await ctx.params;
  const person = await (await getStore()).getRecipient(normalizeCode(code));
  if (!person) return fail(404, "Este gafete no existe.");
  return ok({ person: publicRecipient(person) });
}

// Saldo y movimientos: solo con el NIP de la persona
export async function POST(req: Request, ctx: RouteContext<"/api/people/[code]">) {
  const { code: raw } = await ctx.params;
  const code = normalizeCode(raw);
  const body = await readBody(req);
  const store = await getStore();
  const person = await store.getRecipient(code);
  if (!person) return fail(404, "Este gafete no existe.");
  if ((await store.pinFails(code)) >= LIMITS.pinTries) return fail(429, "Demasiados intentos. El gafete se desbloquea en 10 minutos.");
  if (hashPin(code, String(body.pin ?? "")) !== person.pinHash) {
    const tries = await store.pinFail(code);
    return fail(403, `NIP incorrecto. Quedan ${Math.max(0, LIMITS.pinTries - tries)} intentos.`);
  }
  await store.pinReset(code);
  const txs = await store.recipientTxs(code, 50);
  return ok({ person: { ...publicRecipient(person), balance: person.balance, redeemed: person.redeemed }, txs });
}
