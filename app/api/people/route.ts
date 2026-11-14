import { fail, ok, readBody } from "@/lib/api";
import { clean, getStore, hashPin, newCode, now } from "@/lib/core";

// Registrar a una persona y generar su gafete
export async function POST(req: Request) {
  const body = await readBody(req);
  const alias = clean(body.alias, 40);
  const zone = clean(body.zone, 60);
  const need = clean(body.need, 80);
  const story = clean(body.story, 240);
  const pin = String(body.pin ?? "");
  if (alias.length < 2) return fail(400, "Escribe el nombre o apodo de la persona.");
  if (!/^\d{4}$/.test(pin)) return fail(400, "El NIP debe tener 4 dígitos.");
  if (/^(\d)\1{3}$/.test(pin) || pin === "1234") return fail(400, "Elige un NIP menos obvio que 1234 o 0000.");

  const store = await getStore();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const created = await store.createRecipient({
      code, alias, zone, need, story, balance: 0, received: 0, donations: 0, redeemed: 0,
      createdAt: now(), pinHash: hashPin(code, pin),
    });
    if (created) return ok({ code }, 201);
  }
  return fail(500, "No pudimos generar el gafete. Intenta de nuevo.");
}
