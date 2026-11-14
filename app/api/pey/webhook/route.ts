import { fail, ok } from "@/lib/api";
import { getStore, newId, now } from "@/lib/core";
import { getTransaction, verifyWebhook } from "@/lib/pey";

// Aviso de pago CoDi de Pey: abona el fondeo a la wallet (una sola vez).
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(req.headers, raw)) return fail(401, "firma inválida");
  const event = JSON.parse(raw) as Record<string, unknown>;
  if (event.type !== "codi.qr.payment_received") return ok({ ignored: true });

  const store = await getStore();
  const meta = (event.metadata ?? {}) as { externalMetadata?: { orderId?: string } };
  const fundId = meta.externalMetadata?.orderId;
  const fund =
    (fundId ? await store.getFund(fundId) : null) ??
    (event.codiQrId ? await store.findFundByRef(String(event.codiQrId)) : null);
  if (!fund) return ok({ ignored: "sin fondeo asociado" });

  // El webhook solo es un aviso: el pago se confirma directo con Pey.
  const tx = await getTransaction(String(event.transactionId));
  const breakdown = (tx.amountBreakdown ?? {}) as { base?: number };
  const paid = Math.round(Number(breakdown.base ?? tx.amount ?? 0) * 100);
  if (tx.status !== "PAID" || paid !== fund.amount) return ok({ ignored: "pago no confirmado o monto distinto" });

  const result = await store.confirmFund(fund.id, { id: newId("t"), ts: now(), type: "fund", amount: fund.amount, concept: "Fondeo CoDi" });
  return ok({ result });
}
