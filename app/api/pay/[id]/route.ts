import { fail, ok } from "@/lib/api";
import { directStatus } from "@/lib/direct";

// Estado de un pago directo (la pantalla lo consulta mientras espera al banco)
export async function GET(_req: Request, ctx: RouteContext<"/api/pay/[id]">) {
  const { id } = await ctx.params;
  if (!/^f_[a-f0-9]{24}$/.test(id)) return fail(404, "No encontramos ese pago.");
  const pay = await directStatus(id);
  if (!pay) return fail(404, "No encontramos ese pago.");
  return ok({ pay });
}
