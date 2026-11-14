import type { Donor, Fund, MoveResult, RecipientRecord, Stats, Store, Tx } from "./types";

/**
 * Almacén sobre Redis usando la API REST de Upstash (funciona en serverless,
 * sin conexiones TCP). Los movimientos de dinero corren en scripts Lua para
 * que sean atómicos: no hay doble gasto aunque lleguen dos pagos a la vez.
 */

const P = "ip:";
const LOCK_SEC = 600;

const DONATE = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 'donor' end
if redis.call('EXISTS', KEYS[2]) == 0 then return 'recipient' end
local amt = tonumber(ARGV[1])
local bal = tonumber(redis.call('HGET', KEYS[1], 'balance'))
if bal < amt then return 'funds' end
local nb = redis.call('HINCRBY', KEYS[1], 'balance', -amt)
redis.call('HINCRBY', KEYS[2], 'balance', amt)
redis.call('HINCRBY', KEYS[2], 'received', amt)
redis.call('HINCRBY', KEYS[2], 'donations', 1)
redis.call('LPUSH', KEYS[3], ARGV[2])
redis.call('LPUSH', KEYS[4], ARGV[2])
redis.call('HINCRBY', KEYS[5], 'donated', amt)
redis.call('HINCRBY', KEYS[5], 'donations', 1)
return 'ok:' .. nb
`;

const REDEEM = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 'recipient' end
local amt = tonumber(ARGV[1])
local bal = tonumber(redis.call('HGET', KEYS[1], 'balance'))
if bal < amt then return 'funds' end
local nb = redis.call('HINCRBY', KEYS[1], 'balance', -amt)
redis.call('HINCRBY', KEYS[1], ARGV[3], amt)
redis.call('LPUSH', KEYS[2], ARGV[2])
redis.call('HINCRBY', KEYS[3], ARGV[3], amt)
return 'ok:' .. nb
`;

const CONFIRM_FUND = `
local st = redis.call('HGET', KEYS[1], 'status')
if not st then return 'missing' end
if st ~= 'PENDING' then return 'already' end
local donor = KEYS[2]
if redis.call('EXISTS', donor) == 0 then return 'missing' end
redis.call('HSET', KEYS[1], 'status', 'PAID')
redis.call('HINCRBY', donor, 'balance', tonumber(redis.call('HGET', KEYS[1], 'amount')))
redis.call('LPUSH', KEYS[3], ARGV[1])
return 'ok'
`;

const CREATE_RECIPIENT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('HSET', KEYS[1], unpack(ARGV))
redis.call('HINCRBY', KEYS[2], 'people', 1)
return 1
`;

type Arg = string | number;

function toObject(reply: unknown): Record<string, string> | null {
  if (!reply) return null;
  if (Array.isArray(reply)) {
    if (reply.length === 0) return null;
    const out: Record<string, string> = {};
    for (let i = 0; i < reply.length; i += 2) out[String(reply[i])] = String(reply[i + 1]);
    return out;
  }
  const obj = reply as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return null;
  return Object.fromEntries(keys.map((k) => [k, String(obj[k])]));
}

function flat(obj: Record<string, Arg | undefined>): Arg[] {
  const out: Arg[] = [];
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out.push(k, v);
  return out;
}

function parseTxs(list: unknown): Tx[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => (typeof item === "string" ? JSON.parse(item) : item) as Tx);
}

function move(result: string): MoveResult {
  if (result.startsWith("ok:")) return { ok: true, balance: Number(result.slice(3)) };
  return { ok: false, reason: result as "funds" | "donor" | "recipient" };
}

export class RedisStore implements Store {
  constructor(private url: string, private token: string) {}

  private async cmd<T = unknown>(...args: Arg[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const data = (await res.json()) as { result?: T; error?: string };
    if (!res.ok || data.error) throw new Error(`Redis ${res.status}: ${data.error ?? "error"}`);
    return data.result as T;
  }

  async createDonor(d: Donor) {
    await this.cmd("HSET", `${P}donor:${d.id}`, ...flat(d));
    await this.cmd("HINCRBY", `${P}stats`, "donors", 1);
  }
  async getDonor(id: string): Promise<Donor | null> {
    const h = toObject(await this.cmd("HGETALL", `${P}donor:${id}`));
    if (!h) return null;
    return { id: h.id, name: h.name, balance: Number(h.balance), budget: Number(h.budget), createdAt: Number(h.createdAt) };
  }
  async setBudget(id: string, budget: number) {
    await this.cmd("HSET", `${P}donor:${id}`, "budget", budget);
  }
  async donorTxs(id: string, limit = 200) {
    return parseTxs(await this.cmd("LRANGE", `${P}tx:donor:${id}`, 0, limit - 1));
  }

  async createFund(f: Fund) {
    await this.cmd("HSET", `${P}fund:${f.id}`, ...flat(f));
    if (f.providerRef) await this.cmd("SET", `${P}fundref:${f.providerRef}`, f.id, "EX", 86400);
  }
  async getFund(id: string): Promise<Fund | null> {
    const h = toObject(await this.cmd("HGETALL", `${P}fund:${id}`));
    if (!h) return null;
    return {
      id: h.id, donorId: h.donorId, amount: Number(h.amount), status: h.status as Fund["status"],
      provider: h.provider as Fund["provider"], providerRef: h.providerRef, qrImage: h.qrImage,
      createdAt: Number(h.createdAt),
    };
  }
  async findFundByRef(ref: string) {
    const id = await this.cmd<string | null>("GET", `${P}fundref:${ref}`);
    return id ? this.getFund(id) : null;
  }
  async confirmFund(id: string, tx: Tx) {
    const fund = await this.getFund(id);
    if (!fund) return "missing" as const;
    return this.cmd<"ok" | "already" | "missing">(
      "EVAL", CONFIRM_FUND, 3,
      `${P}fund:${id}`, `${P}donor:${fund.donorId}`, `${P}tx:donor:${fund.donorId}`,
      JSON.stringify(tx),
    );
  }

  async createRecipient(r: RecipientRecord) {
    const created = await this.cmd<number>("EVAL", CREATE_RECIPIENT, 2, `${P}rec:${r.code}`, `${P}stats`, ...flat(r));
    return created === 1;
  }
  async getRecipient(code: string): Promise<RecipientRecord | null> {
    const h = toObject(await this.cmd("HGETALL", `${P}rec:${code}`));
    if (!h) return null;
    return {
      code: h.code, alias: h.alias, zone: h.zone ?? "", need: h.need ?? "", story: h.story ?? "",
      balance: Number(h.balance), received: Number(h.received), donations: Number(h.donations),
      redeemed: Number(h.redeemed), paidOut: Number(h.paidOut ?? 0), createdAt: Number(h.createdAt), pinHash: h.pinHash,
      payout: h.payout as RecipientRecord["payout"], clabe: h.clabe, bank: h.bank, legalName: h.legalName,
      curp: h.curp, account: h.account,
    };
  }
  async recipientTxs(code: string, limit = 100) {
    return parseTxs(await this.cmd("LRANGE", `${P}tx:rec:${code}`, 0, limit - 1));
  }

  async donate(donorId: string, code: string, amount: number, tx: Tx) {
    const result = await this.cmd<string>(
      "EVAL", DONATE, 5,
      `${P}donor:${donorId}`, `${P}rec:${code}`, `${P}tx:donor:${donorId}`, `${P}tx:rec:${code}`, `${P}stats`,
      amount, JSON.stringify(tx),
    );
    return move(result);
  }
  async redeem(code: string, amount: number, tx: Tx, kind: "redeem" | "payout" = "redeem") {
    const result = await this.cmd<string>(
      "EVAL", REDEEM, 3, `${P}rec:${code}`, `${P}tx:rec:${code}`, `${P}stats`,
      amount, JSON.stringify(tx), kind === "payout" ? "paidOut" : "redeemed",
    );
    return move(result);
  }

  async pinFail(code: string) {
    const key = `${P}pinfail:${code}`;
    const n = await this.cmd<number>("INCR", key);
    if (n === 1) await this.cmd("EXPIRE", key, LOCK_SEC);
    return n;
  }
  async pinFails(code: string) {
    return Number((await this.cmd<string | null>("GET", `${P}pinfail:${code}`)) ?? 0);
  }
  async pinReset(code: string) {
    await this.cmd("DEL", `${P}pinfail:${code}`);
  }

  async stats(): Promise<Stats> {
    const h = toObject(await this.cmd("HGETALL", `${P}stats`)) ?? {};
    return {
      donated: Number(h.donated ?? 0), donations: Number(h.donations ?? 0), redeemed: Number(h.redeemed ?? 0),
      paidOut: Number(h.paidOut ?? 0), people: Number(h.people ?? 0), donors: Number(h.donors ?? 0),
    };
  }
}
