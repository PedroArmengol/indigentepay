import { fail, ok, readBody, walletFrom } from "@/lib/api";
import { LIMITS, getStore, newId, now, toCents } from "@/lib/core";
import { createCodiPush, createCodiQr, peyEnabled } from "@/lib/pey";
import type { Fund } from "@/lib/types";

// Crear una orden de fondeo de la wallet
export async function POST(req: Request) {
  const donor = await walletFrom(req);
  if (!donor) return fail(401, "No encontramos tu wallet en este dispositivo.");
  const body = await readBody(req);
  const amount = toCents(body.amount);
  if (!amount || amount < LIMITS.fundMin || amount > LIMITS.fundMax) {
    return fail(400, "Puedes fondear entre $1 y $5,000 por operación.");
  }
  if (donor.balance + amount > LIMITS.walletMax) return fail(400, "Tu wallet no puede guardar más de $20,000.");

  const fund: Fund = { id: newId("f"), donorId: donor.id, amount, status: "PENDING", provider: "sim", createdAt: now() };
  if (peyEnabled()) {
    // Cobro CoDi real: el dinero llega a la cuenta concentradora y se abona a la subcuenta de esta wallet.
    const numRef = String(now() % 10_000_000);
    const phone = String(body.phone ?? "").replace(/\D/g, "");
    try {
      fund.provider = "pey";
      if (body.method === "pn") {
        if (!/^\d{10}$/.test(phone)) return fail(400, "Escribe tu celular a 10 dígitos.");
        const push = await createCodiPush(amount, fund.id, numRef, phone);
        fund.method = "pn";
        fund.providerRef = push.transactionId;
      } else {
        const qr = await createCodiQr(amount, fund.id, numRef);
        fund.method = "qr";
        fund.providerRef = qr.id;
        fund.qrImage = qr.qrImage;
        fund.qrString = qr.qrString;
      }
    } catch (err) {
      console.error("pey", err);
      return fail(502, "No pudimos generar el cobro CoDi. Intenta de nuevo.", { detail: String(err).slice(0, 200) });
    }
  }
  await (await getStore()).createFund(fund);
  return ok({
    fund: { id: fund.id, amount: fund.amount, status: fund.status, provider: fund.provider, method: fund.method, qrImage: fund.qrImage, qrString: fund.qrString },
  }, 201);
}
