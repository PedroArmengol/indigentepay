import { fail, ok, walletFrom } from "@/lib/api";
import { getStore, newId, now } from "@/lib/core";

// Estado de un fondeo (la pantalla lo consulta mientras espera el pago)
export async function GET(req: Request, ctx: RouteContext<"/api/fund/[id]">) {
  const donor = await walletFrom(req);
  const { id } = await ctx.params;
  const fund = donor ? await (await getStore()).getFund(id) : null;
  if (!donor || !fund || fund.donorId !== donor.id) return fail(404, "No encontramos ese fondeo.");
  return ok({ fund: { id: fund.id, amount: fund.amount, status: fund.status, provider: fund.provider } });
}

// Confirmar un fondeo SIMULADO. Los fondeos reales solo los confirma el webhook de Pey.
export async function POST(req: Request, ctx: RouteContext<"/api/fund/[id]">) {
  const donor = await walletFrom(req);
  const { id } = await ctx.params;
  const store = await getStore();
  const fund = donor ? await store.getFund(id) : null;
  if (!donor || !fund || fund.donorId !== donor.id) return fail(404, "No encontramos ese fondeo.");
  if (fund.provider !== "sim") return fail(409, "Este fondeo se confirma cuando tu banco avisa del pago.");
  const result = await store.confirmFund(id, { id: newId("t"), ts: now(), type: "fund", amount: fund.amount, concept: "Fondeo simulado" });
  if (result === "missing") return fail(404, "No encontramos ese fondeo.");
  const fresh = await store.getDonor(donor.id);
  return ok({ status: "PAID", balance: fresh?.balance ?? 0, repeated: result === "already" });
}
