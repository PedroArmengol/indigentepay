import { fail, ok, readBody, walletFrom } from "@/lib/api";
import { LIMITS, budgetSummary, clean, getStore, newId, now, toCents } from "@/lib/core";

// Crear wallet
export async function POST(req: Request) {
  const body = await readBody(req);
  const name = clean(body.name, 40);
  if (name.length < 2) return fail(400, "Escribe tu nombre para crear la wallet.");
  const budget = toCents(body.budget ?? 500) ?? 500_00;
  if (budget > LIMITS.budgetMax) return fail(400, "El presupuesto mensual máximo es $50,000.");
  const donor = { id: newId("d"), name, balance: 0, budget, createdAt: now() };
  await (await getStore()).createDonor(donor);
  return ok({ donor }, 201);
}

// Saldo, presupuesto del mes y movimientos
export async function GET(req: Request) {
  const donor = await walletFrom(req);
  if (!donor) return fail(401, "No encontramos tu wallet en este dispositivo.");
  const txs = await (await getStore()).donorTxs(donor.id, 300);
  return ok({ donor, summary: budgetSummary(txs, donor.budget), txs: txs.slice(0, 50) });
}

// Cambiar el presupuesto mensual
export async function PATCH(req: Request) {
  const donor = await walletFrom(req);
  if (!donor) return fail(401, "No encontramos tu wallet en este dispositivo.");
  const body = await readBody(req);
  const budget = toCents(body.budget);
  if (!budget || budget > LIMITS.budgetMax) return fail(400, "Escribe un presupuesto entre $1 y $50,000.");
  await (await getStore()).setBudget(donor.id, budget);
  return ok({ budget });
}
