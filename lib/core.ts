import { createHash, randomBytes, randomInt } from "node:crypto";
import { MemoryStore } from "./store-memory";
import { RedisStore } from "./store-redis";
import type { Recipient, RecipientRecord, Store, Tx } from "./types";

// ----------------------------------------------------------------- almacén
type Globals = { __ipStore?: Store; __ipSeed?: Promise<void> };
const g = globalThis as unknown as Globals;

const REDIS_PAIRS: [RegExp, string][] = [
  [/REST_API_URL$/, "REST_API_TOKEN"], // KV_REST_API_URL (y con prefijo: MIAPP_KV_REST_API_URL)
  [/REDIS_REST_URL$/, "REDIS_REST_TOKEN"], // UPSTASH_REDIS_REST_URL
];

/**
 * Busca las credenciales REST de Upstash. Vercel deja poner un prefijo propio al
 * conectar la base, así que se acepta cualquier nombre con estas terminaciones.
 */
export function redisEnv(): { url: string; token: string } | null {
  const env = process.env;
  const keys = Object.keys(env).sort((a, b) => a.length - b.length);
  for (const [urlEnd, tokenEnd] of REDIS_PAIRS) {
    for (const key of keys) {
      if (!urlEnd.test(key)) continue;
      const url = env[key];
      const token = env[key.replace(urlEnd, tokenEnd)];
      if (url && token) return { url, token };
    }
  }
  return null;
}

/** Nombres (nunca valores) de las variables de Redis presentes: sirve para diagnosticar el despliegue. */
export function redisVarNames(): string[] {
  return Object.keys(process.env).filter((k) => /KV_|REDIS|UPSTASH/i.test(k)).sort();
}

export function storageKind(): "redis" | "memoria" {
  return redisEnv() ? "redis" : "memoria";
}

export async function getStore(): Promise<Store> {
  if (!g.__ipStore) {
    const env = redisEnv();
    g.__ipStore = env ? new RedisStore(env.url, env.token) : new MemoryStore();
  }
  if (!g.__ipSeed) {
    g.__ipSeed = seed(g.__ipStore).catch((err) => {
      g.__ipSeed = undefined;
      throw err;
    });
  }
  await g.__ipSeed;
  return g.__ipStore;
}

// --------------------------------------------------------------- límites
export const LIMITS = {
  fundMin: 10_00,
  fundMax: 5_000_00,
  walletMax: 20_000_00,
  donateMin: 1_00,
  donateMax: 1_000_00,
  redeemMin: 1_00,
  redeemMax: 2_000_00,
  budgetMax: 50_000_00,
  pinTries: 5,
};

// ------------------------------------------------------------- utilidades
export const now = () => Date.now();
export const newId = (prefix: string) => `${prefix}_${randomBytes(12).toString("hex")}`;

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O, 1/I/L
export function newCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function normalizeCode(raw: string): string {
  const text = String(raw ?? "").trim();
  const fromUrl = text.match(/\/(?:p|gafete|saldo)\/([A-Za-z0-9]{4,12})/);
  return (fromUrl ? fromUrl[1] : text).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function hashPin(code: string, pin: string): string {
  const salt = process.env.PIN_SALT || "indigentepay";
  return createHash("sha256").update(`${salt}:${code}:${pin}`).digest("hex");
}

/** Pesos (número o texto) → centavos. Regresa null si no es un monto válido. */
export function toCents(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function clean(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function publicRecipient(r: RecipientRecord): Omit<Recipient, "balance" | "redeemed"> {
  return {
    code: r.code, alias: r.alias, zone: r.zone, need: r.need, story: r.story,
    received: r.received, donations: r.donations, createdAt: r.createdAt,
  };
}

// ------------------------------------------------- presupuesto del donante
const MX = "America/Mexico_City";
const monthFmt = new Intl.DateTimeFormat("en-CA", { timeZone: MX, year: "numeric", month: "2-digit" });
export const monthKey = (ts: number) => monthFmt.format(new Date(ts)).slice(0, 7);

export function budgetSummary(txs: Tx[], budget: number, at = now()) {
  const current = monthKey(at);
  const months: { key: string; total: number }[] = [];
  const d = new Date(at);
  for (let i = 5; i >= 0; i--) {
    const key = monthKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 15));
    months.push({ key, total: 0 });
  }
  const people = new Set<string>();
  let spent = 0;
  let count = 0;
  for (const tx of txs) {
    if (tx.type !== "donation") continue;
    const key = monthKey(tx.ts);
    const slot = months.find((m) => m.key === key);
    if (slot) slot.total += tx.amount;
    if (key === current) {
      spent += tx.amount;
      count += 1;
      if (tx.code) people.add(tx.code);
    }
  }
  return { month: current, budget, spent, remaining: Math.max(0, budget - spent), over: Math.max(0, spent - budget), count, people: people.size, months };
}

// ---------------------------------------------------------- datos de demo
export const DEMO_PIN = "1234";
export const DEMO_PEOPLE = [
  { code: "LUPITA", alias: "Doña Lupita", zone: "Metro Insurgentes, salida Génova", need: "Comida caliente y sus medicinas", story: "Vende dulces afuera del metro desde hace seis años. Quiere juntar para rentar un cuarto." },
  { code: "TOÑO22", alias: "Don Toño", zone: "Alameda Central", need: "Cena y un lugar donde bañarse", story: "Fue albañil hasta que se lastimó la espalda. Duerme cerca del Hemiciclo." },
  { code: "MARCO7", alias: "Marco", zone: "Glorieta de los Insurgentes", need: "Pasaje y comida para llegar a entrevistas", story: "Tiene 24 años y llegó de Veracruz buscando trabajo." },
].map((p) => ({ ...p, code: p.code.replace("Ñ", "N") }));

async function seed(store: Store) {
  for (const p of DEMO_PEOPLE) {
    await store.createRecipient({
      ...p, balance: 0, received: 0, donations: 0, redeemed: 0, createdAt: now(), pinHash: hashPin(p.code, DEMO_PIN),
    });
  }
}
