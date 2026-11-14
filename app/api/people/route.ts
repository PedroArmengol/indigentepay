import { fail, ok, readBody } from "@/lib/api";
import { bancoDeClabe, clabeValida } from "@/lib/clabe";
import { clean, getStore, hashPin, newAccountNumber, newCode, now } from "@/lib/core";
import { calcularCurp, edad, fechaValida } from "@/lib/curp";
import type { RecipientRecord } from "@/lib/types";

// Registrar a una persona, definir cómo recibe su dinero y generar su gafete
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

  const account: Partial<RecipientRecord> = {};
  if (body.payout === "clabe") {
    // Opción 1: ya tiene cuenta de banco
    const clabe = String(body.clabe ?? "").replace(/\D/g, "");
    if (!clabeValida(clabe)) return fail(400, "Esa CLABE no es válida. Revisa los 18 dígitos.");
    Object.assign(account, { payout: "clabe", clabe, bank: bancoDeClabe(clabe) });
  } else if (body.payout === "n2bis") {
    // Opción 2: no tiene cuenta; se le abre una cuenta básica (simulada) con su CURP calculada
    const names = clean(body.names, 50);
    const surname1 = clean(body.surname1, 40);
    const surname2 = clean(body.surname2, 40);
    const birth = String(body.birth ?? "");
    if (names.length < 2 || surname1.length < 2) return fail(400, "Escribe el nombre y el primer apellido de la persona.");
    if (!fechaValida(birth)) return fail(400, "Escribe una fecha de nacimiento válida.");
    if (edad(birth) < 18) return fail(400, "Para abrirle una cuenta la persona debe ser mayor de edad.");
    const curp = calcularCurp({ names, surname1, surname2, birth, sex: body.sex as "H" | "M" | "X", state: String(body.state ?? "") });
    if (!curp) return fail(400, "Faltan el sexo o el estado de nacimiento para calcular la CURP.");
    Object.assign(account, {
      payout: "n2bis", curp, legalName: [names, surname1, surname2].filter(Boolean).join(" "), account: newAccountNumber(),
    });
  } else {
    return fail(400, "Elige cómo va a recibir su dinero la persona.");
  }

  const store = await getStore();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const created = await store.createRecipient({
      code, alias, zone, need, story, balance: 0, received: 0, donations: 0, redeemed: 0, paidOut: 0,
      createdAt: now(), pinHash: hashPin(code, pin), ...account,
    });
    if (created) {
      // Estos datos solo se regresan aquí, a quien hizo el registro; el perfil público no los muestra.
      return ok({
        code, payout: account.payout, curp: account.curp, account: account.account, legalName: account.legalName,
        bank: account.bank, clabeEnd: account.clabe?.slice(-4),
      }, 201);
    }
  }
  return fail(500, "No pudimos generar el gafete. Intenta de nuevo.");
}
