import { fail, ok, readBody, walletFrom } from "@/lib/api";
import { LIMITS, getStore, newId, now, toCents } from "@/lib/core";
import { createCodiQr, peyEnabled } from "@/lib/pey";
import type { Fund } from "@/lib/types";

// Crear una orden de fondeo de la wallet
export async function POST(req: Request) {
  const donor = await walletFrom(req);
  if (!donor) return fail(401, "No encontramos tu wallet en este dispositivo.");
  const body = await readBody(req);
  const amount = toCents(body.amount);
  if (!amount || amount < LIMITS.fundMin || amount > LIMITS.fundMax) {
    return fail(400, "Puedes fondear entre $10 y $5,000 por operación.");
  }
  if (donor.balance + amount > LIMITS.walletMax) return fail(400, "Tu wallet no puede guardar más de $20,000.");

  const fund: Fund = { id: newId("f"), donorId: donor.id, amount, status: "PENDING", provider: "sim", createdAt: now() };
  if (peyEnabled()) {
    try {
      const qr = await createCodiQr(amount, fund.id, String(now() % 10_000_000));
      fund.provider = "pey";
      fund.providerRef = qr.id;
      fund.qrImage = qr.qrImage;
    } catch (err) {
      console.error("pey", err);
      return fail(502, "No pudimos generar el cobro CoDi. Intenta de nuevo.");
    }
  }
  await (await getStore()).createFund(fund);
  return ok({ fund: view(fund) }, 201);
}

function view(f: Fund) {
  return { id: f.id, amount: f.amount, status: f.status, provider: f.provider, qrImage: f.qrImage };
}
