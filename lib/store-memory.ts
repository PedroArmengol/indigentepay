import type { Donor, Fund, MoveResult, RecipientRecord, Stats, Store, Tx } from "./types";

const LOCK_MS = 10 * 60 * 1000;

/** Almacén en memoria: para desarrollo local y pruebas. Se pierde al reiniciar. */
export class MemoryStore implements Store {
  private donors = new Map<string, Donor>();
  private recipients = new Map<string, RecipientRecord>();
  private funds = new Map<string, Fund>();
  private donorTx = new Map<string, Tx[]>();
  private recTx = new Map<string, Tx[]>();
  private fails = new Map<string, { n: number; until: number }>();
  private totals = { donated: 0, donations: 0, redeemed: 0 };

  async createDonor(d: Donor) {
    this.donors.set(d.id, { ...d });
  }
  async getDonor(id: string) {
    const d = this.donors.get(id);
    return d ? { ...d } : null;
  }
  async setBudget(id: string, budget: number) {
    const d = this.donors.get(id);
    if (d) d.budget = budget;
  }
  async donorTxs(id: string, limit = 200) {
    return (this.donorTx.get(id) ?? []).slice(0, limit);
  }

  async createFund(f: Fund) {
    this.funds.set(f.id, { ...f });
  }
  async getFund(id: string) {
    const f = this.funds.get(id);
    return f ? { ...f } : null;
  }
  async findFundByRef(ref: string) {
    for (const f of this.funds.values()) if (f.providerRef === ref) return { ...f };
    return null;
  }
  async confirmFund(id: string, tx: Tx) {
    const f = this.funds.get(id);
    if (!f) return "missing" as const;
    if (f.status !== "PENDING") return "already" as const;
    const d = this.donors.get(f.donorId);
    if (!d) return "missing" as const;
    f.status = "PAID";
    d.balance += f.amount;
    this.push(this.donorTx, d.id, tx);
    return "ok" as const;
  }

  async createRecipient(r: RecipientRecord) {
    if (this.recipients.has(r.code)) return false;
    this.recipients.set(r.code, { ...r });
    return true;
  }
  async getRecipient(code: string) {
    const r = this.recipients.get(code);
    return r ? { ...r } : null;
  }
  async recipientTxs(code: string, limit = 100) {
    return (this.recTx.get(code) ?? []).slice(0, limit);
  }

  async donate(donorId: string, code: string, amount: number, tx: Tx): Promise<MoveResult> {
    const d = this.donors.get(donorId);
    if (!d) return { ok: false, reason: "donor" };
    const r = this.recipients.get(code);
    if (!r) return { ok: false, reason: "recipient" };
    if (d.balance < amount) return { ok: false, reason: "funds" };
    d.balance -= amount;
    r.balance += amount;
    r.received += amount;
    r.donations += 1;
    this.totals.donated += amount;
    this.totals.donations += 1;
    this.push(this.donorTx, donorId, tx);
    this.push(this.recTx, code, tx);
    return { ok: true, balance: d.balance };
  }

  async redeem(code: string, amount: number, tx: Tx): Promise<MoveResult> {
    const r = this.recipients.get(code);
    if (!r) return { ok: false, reason: "recipient" };
    if (r.balance < amount) return { ok: false, reason: "funds" };
    r.balance -= amount;
    r.redeemed += amount;
    this.totals.redeemed += amount;
    this.push(this.recTx, code, tx);
    return { ok: true, balance: r.balance };
  }

  async pinFail(code: string) {
    const now = Date.now();
    const cur = this.fails.get(code);
    const next = cur && cur.until > now ? { n: cur.n + 1, until: cur.until } : { n: 1, until: now + LOCK_MS };
    this.fails.set(code, next);
    return next.n;
  }
  async pinFails(code: string) {
    const cur = this.fails.get(code);
    return cur && cur.until > Date.now() ? cur.n : 0;
  }
  async pinReset(code: string) {
    this.fails.delete(code);
  }

  async stats(): Promise<Stats> {
    return { ...this.totals, people: this.recipients.size, donors: this.donors.size };
  }

  private push(map: Map<string, Tx[]>, key: string, tx: Tx) {
    const list = map.get(key) ?? [];
    list.unshift(tx);
    map.set(key, list);
  }
}
