import { createHmac, timingSafeEqual } from "node:crypto";
import type { Fund } from "./types";

/**
 * Cobro CoDi real con la API de Pey (https://docs.pey.mx).
 * Se activa solo si existe PEY_API_KEY; si no, el fondeo es simulado.
 *
 * El dinero llega a la cuenta concentradora ligada a la API key. IndigentePay
 * lleva el libro de subcuentas: cada wallet y cada gafete es una subcuenta.
 *
 * - POST /codi/qr              → QR CoDi (PNG en base64 con generateImage).
 * - POST /codi/pn              → cobro a la app del banco del celular (10 dígitos).
 * - GET  /transaction/{id}     → estado de una transacción.
 * - GET  /transaction/api-key  → últimas transacciones (para confirmar un QR sin webhook).
 * - Webhook: Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature).
 */

const BASE = (process.env.PEY_BASE_URL || "https://api.pey.mx").replace(/\/$/, "");
const EXPIRATION_SEC = 360; // mínimo que acepta Pey

export const peyEnabled = () => Boolean(process.env.PEY_API_KEY);

type Json = Record<string, unknown>;

async function request(method: string, path: string, json?: unknown): Promise<Json> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.PEY_API_KEY}`, "Content-Type": "application/json" },
    body: json ? JSON.stringify(json) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    const err = (data.error ?? data) as Json;
    throw new Error(`Pey ${res.status}: ${String(err.message ?? JSON.stringify(data).slice(0, 200))}`);
  }
  return data;
}

function common(amountCents: number, fundId: string, numRef: string): Json {
  const body: Json = {
    amount: amountCents / 100,
    concept: "IndigentePay fondeo",
    numRef,
    expiration: EXPIRATION_SEC,
    metadata: { orderId: fundId },
  };
  if (process.env.PEY_BANK_ACCOUNT_ID) body.bankAccountId = process.env.PEY_BANK_ACCOUNT_ID;
  return body;
}

export async function createCodiQr(amountCents: number, fundId: string, numRef: string) {
  const res = await request("POST", "/codi/qr", { ...common(amountCents, fundId, numRef), generateImage: true });
  return {
    id: String(res.id),
    qrImage: res.qrImage ? String(res.qrImage) : undefined,
    qrString: res.qrString ? String(res.qrString) : undefined,
  };
}

/** Manda la solicitud de cobro a la app del banco ligada a ese celular. */
export async function createCodiPush(amountCents: number, fundId: string, numRef: string, phone10: string) {
  const res = await request("POST", "/codi/pn", { ...common(amountCents, fundId, numRef), phoneNumber: phone10 });
  return { transactionId: String(res.transactionId) };
}

export async function getTransaction(id: string) {
  return request("GET", `/transaction/${encodeURIComponent(id)}`);
}

/** ¿La transacción está pagada y por el monto del fondeo? */
export function paidInFull(tx: Json, amountCents: number): boolean {
  if (tx.status !== "PAID") return false;
  const breakdown = (tx.amountBreakdown ?? {}) as { base?: number };
  const candidates = [breakdown.base, tx.amount].filter((v) => v !== undefined && v !== null);
  return candidates.some((v) => Math.round(Number(v) * 100) === amountCents);
}

/**
 * Busca en Pey el pago de un fondeo pendiente. Sirve de respaldo al webhook:
 * la pantalla de fondeo lo consulta mientras espera.
 */
export async function findPayment(fund: Fund): Promise<boolean> {
  if (!fund.providerRef) return false;
  if (fund.method === "pn") return paidInFull(await getTransaction(fund.providerRef), fund.amount);
  const list = await request("GET", "/transaction/api-key");
  const items = Array.isArray(list.items) ? (list.items as Json[]) : [];
  return items.some((tx) => {
    const mine = tx.payableId === fund.providerRef || JSON.stringify(tx.metadata ?? {}).includes(fund.id);
    return mine && paidInFull(tx, fund.amount);
  });
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
