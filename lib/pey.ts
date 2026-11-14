import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cobro CoDi real con la API de Pey (https://docs.pey.mx).
 * Se activa solo si existe PEY_API_KEY; si no, el fondeo es simulado.
 *
 * - POST /codi/qr            → QR CoDi (PNG en base64 con generateImage).
 * - GET  /transaction/{id}   → confirmación del pago (status PAID).
 * - Webhook: Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature).
 */

const BASE = (process.env.PEY_BASE_URL || "https://api.pey.mx").replace(/\/$/, "");

export const peyEnabled = () => Boolean(process.env.PEY_API_KEY);

async function request(method: string, path: string, json?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.PEY_API_KEY}`, "Content-Type": "application/json" },
    body: json ? JSON.stringify(json) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Pey ${res.status}: ${data?.error?.message ?? "error"}`);
  return data as Record<string, unknown>;
}

export async function createCodiQr(amountCents: number, fundId: string, numRef: string) {
  const body: Record<string, unknown> = {
    amount: amountCents / 100,
    concept: "IndigentePay fondeo",
    numRef,
    expiration: 360,
    generateImage: true,
    metadata: { orderId: fundId },
  };
  if (process.env.PEY_BANK_ACCOUNT_ID) body.bankAccountId = process.env.PEY_BANK_ACCOUNT_ID;
  const res = await request("POST", "/codi/qr", body);
  return { id: String(res.id), qrImage: res.qrImage ? String(res.qrImage) : undefined };
}

export async function getTransaction(id: string) {
  return request("GET", `/transaction/${encodeURIComponent(id)}`);
}

/** Valida la firma del webhook. Regresa el webhook-id o null si no es válida. */
export function verifyWebhook(headers: Headers, rawBody: string, toleranceSec = 300): string | null {
  const secret = process.env.PEY_WEBHOOK_SECRET;
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!secret || !id || !timestamp || !signatures) return null;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSec) return null;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  for (const candidate of signatures.split(" ")) {
    const [version, sig] = candidate.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return id;
  }
  return null;
}
