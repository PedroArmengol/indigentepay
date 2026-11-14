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

/** A quién va el cobro. Con `recipient`, el pago queda referenciado al gafete de esa persona. */
export type Destino = { concept?: string; recipient?: string };

function common(amountCents: number, fundId: string, numRef: string, destino: Destino = {}): Json {
  const metadata: Json = { orderId: fundId };
  if (destino.recipient) metadata.recipient = destino.recipient;
  const body: Json = {
    amount: amountCents / 100,
    concept: (destino.concept ?? "IndigentePay fondeo").slice(0, 40),
    numRef,
    expiration: EXPIRATION_SEC,
    metadata,
  };
  if (process.env.PEY_BANK_ACCOUNT_ID) body.bankAccountId = process.env.PEY_BANK_ACCOUNT_ID;
  return body;
}

export async function createCodiQr(amountCents: number, fundId: string, numRef: string, destino?: Destino) {
  const res = await request("POST", "/codi/qr", { ...common(amountCents, fundId, numRef, destino), generateImage: true });
  return {
    id: String(res.id),
    qrImage: res.qrImage ? String(res.qrImage) : undefined,
    qrString: res.qrString ? String(res.qrString) : undefined,
  };
}

/**
 * QR CoDi fijo de una persona: sin monto (lo teclea quien paga) y sin vencimiento.
 * Es el que se imprime en su gafete; cada pago llega referenciado a ella.
 */
export async function createStaticQr(recipient: string, alias: string, numRef: string) {
  const body: Json = { amount: 0, concept: `Donativo ${alias}`.slice(0, 40), numRef, metadata: { recipient } };
  if (process.env.PEY_BANK_ACCOUNT_ID) body.bankAccountId = process.env.PEY_BANK_ACCOUNT_ID;
  const res = await request("POST", "/codi/qr", body);
  return { id: String(res.id), qrString: String(res.qrString ?? "") };
}

/** Últimas transacciones de la llave (hasta 80, de la más nueva a la más vieja). */
export async function listTransactions(): Promise<Json[]> {
  const list = await request("GET", "/transaction/api-key");
  return Array.isArray(list.items) ? (list.items as Json[]) : [];
}

/** Monto pagado de una transacción, en centavos. */
export function paidCents(tx: Json): number {
  const breakdown = (tx.amountBreakdown ?? {}) as { base?: number };
  return Math.round(Number(breakdown.base ?? tx.amount ?? 0) * 100);
}

/** Manda la solicitud de cobro a la app del banco ligada a ese celular. */
export async function createCodiPush(amountCents: number, fundId: string, numRef: string, phone10: string, destino?: Destino) {
  const res = await request("POST", "/codi/pn", { ...common(amountCents, fundId, numRef, destino), phoneNumber: phone10 });
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
