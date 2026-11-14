import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { budgetSummary, hashPin, normalizeCode, toCents } from "../lib/core";
import { MemoryStore } from "../lib/store-memory";
import { RedisStore } from "../lib/store-redis";
import type { Store, Tx } from "../lib/types";
import { startShim } from "./upstash-shim";

const tx = (type: Tx["type"], amount: number, extra: Partial<Tx> = {}): Tx => ({
  id: "t_" + Math.random().toString(16).slice(2), ts: Date.now(), type, amount, ...extra,
});

function suite(name: string, make: () => Store) {
  describe(name, () => {
    it("fondea, dona y canjea sin perder ni duplicar dinero", async () => {
      const s = make();
      await s.createDonor({ id: "d_1", name: "Pedro", balance: 0, budget: 500_00, createdAt: 1 });
      assert.equal(await s.createRecipient({ code: "AAA111", alias: "Lupita", zone: "", need: "", story: "", balance: 0, received: 0, donations: 0, redeemed: 0, createdAt: 1, pinHash: "h" }), true);
      assert.equal(await s.createRecipient({ code: "AAA111", alias: "Otra", zone: "", need: "", story: "", balance: 0, received: 0, donations: 0, redeemed: 0, createdAt: 1, pinHash: "h" }), false);

      await s.createFund({ id: "f_1", donorId: "d_1", amount: 200_00, status: "PENDING", provider: "sim", createdAt: 1 });
      assert.equal(await s.confirmFund("f_1", tx("fund", 200_00)), "ok");
      assert.equal(await s.confirmFund("f_1", tx("fund", 200_00)), "already"); // un webhook repetido no abona dos veces
      assert.equal(await s.confirmFund("f_x", tx("fund", 1)), "missing");
      assert.equal((await s.getDonor("d_1"))!.balance, 200_00);

      assert.deepEqual(await s.donate("d_1", "AAA111", 50_00, tx("donation", 50_00, { code: "AAA111" })), { ok: true, balance: 150_00 });
      assert.deepEqual(await s.donate("d_1", "AAA111", 500_00, tx("donation", 500_00)), { ok: false, reason: "funds" });
      assert.deepEqual(await s.donate("d_1", "NOPE", 1_00, tx("donation", 1_00)), { ok: false, reason: "recipient" });
      assert.deepEqual(await s.donate("d_zz", "AAA111", 1_00, tx("donation", 1_00)), { ok: false, reason: "donor" });

      const r = (await s.getRecipient("AAA111"))!;
      assert.equal(r.alias, "Lupita");
      assert.deepEqual([r.balance, r.received, r.donations], [50_00, 50_00, 1]);

      assert.deepEqual(await s.redeem("AAA111", 35_00, tx("redeem", 35_00, { merchant: "Fonda" })), { ok: true, balance: 15_00 });
      assert.deepEqual(await s.redeem("AAA111", 99_00, tx("redeem", 99_00)), { ok: false, reason: "funds" });

      assert.deepEqual((await s.donorTxs("d_1")).map((t) => t.type), ["donation", "fund"]);
      assert.deepEqual((await s.recipientTxs("AAA111")).map((t) => t.type), ["redeem", "donation"]);
      assert.deepEqual(await s.stats(), { donated: 50_00, donations: 1, redeemed: 35_00, people: 1, donors: 1 });
    });

    it("no permite doble gasto con donativos simultáneos", async () => {
      const s = make();
      await s.createDonor({ id: "d_2", name: "Ana", balance: 0, budget: 1, createdAt: 1 });
      await s.createRecipient({ code: "BBB222", alias: "Toño", zone: "", need: "", story: "", balance: 0, received: 0, donations: 0, redeemed: 0, createdAt: 1, pinHash: "h" });
      await s.createFund({ id: "f_2", donorId: "d_2", amount: 100_00, status: "PENDING", provider: "sim", createdAt: 1 });
      await s.confirmFund("f_2", tx("fund", 100_00));
      const results = await Promise.all(Array.from({ length: 10 }, () => s.donate("d_2", "BBB222", 30_00, tx("donation", 30_00))));
      assert.equal(results.filter((r) => r.ok).length, 3);
      assert.equal((await s.getDonor("d_2"))!.balance, 10_00);
      assert.equal((await s.getRecipient("BBB222"))!.balance, 90_00);
    });

    it("cuenta intentos de NIP y los reinicia", async () => {
      const s = make();
      assert.equal(await s.pinFails("CCC333"), 0);
      assert.equal(await s.pinFail("CCC333"), 1);
      assert.equal(await s.pinFail("CCC333"), 2);
      assert.equal(await s.pinFails("CCC333"), 2);
      await s.pinReset("CCC333");
      assert.equal(await s.pinFails("CCC333"), 0);
    });

    it("guarda presupuesto y referencia de fondeo", async () => {
      const s = make();
      await s.createDonor({ id: "d_3", name: "Luz", balance: 0, budget: 100_00, createdAt: 1 });
      await s.setBudget("d_3", 800_00);
      assert.equal((await s.getDonor("d_3"))!.budget, 800_00);
      await s.createFund({ id: "f_3", donorId: "d_3", amount: 10_00, status: "PENDING", provider: "pey", providerRef: "QR9", qrImage: "abc", createdAt: 1 });
      assert.equal((await s.findFundByRef("QR9"))!.id, "f_3");
      assert.equal(await s.findFundByRef("nada"), null);
      assert.equal(await s.getDonor("nadie"), null);
      assert.equal(await s.getRecipient("NADIE"), null);
    });
  });
}

suite("MemoryStore", () => new MemoryStore());

describe("RedisStore (redis-server local)", () => {
  let proc: ReturnType<typeof spawn>;
  let shim: ReturnType<typeof startShim>;
  before(async () => {
    proc = spawn("redis-server", ["--port", "6399", "--save", "", "--appendonly", "no"], { stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 600));
    shim = startShim(6399, 8079);
  });
  after(() => { shim.close(); proc.kill(); });
  suite("RedisStore", () => { void shim.flush(); return new RedisStore("http://127.0.0.1:8079", "test"); });
});

describe("utilidades", () => {
  it("convierte montos y códigos", () => {
    assert.equal(toCents("20"), 20_00);
    assert.equal(toCents("$1,500.50"), 1500_50);
    assert.equal(toCents(0), null);
    assert.equal(toCents("abc"), null);
    assert.equal(normalizeCode("https://x.app/p/lupita"), "LUPITA");
    assert.equal(normalizeCode(" k7m-2qx "), "K7M2QX");
    assert.notEqual(hashPin("A", "1234"), hashPin("B", "1234"));
  });
  it("resume el presupuesto del mes", () => {
    const at = Date.UTC(2026, 10, 14, 18);
    const txs: Tx[] = [
      { id: "1", ts: at, type: "donation", amount: 50_00, code: "A" },
      { id: "2", ts: at - 3600_000, type: "donation", amount: 20_00, code: "B" },
      { id: "3", ts: at, type: "fund", amount: 500_00 },
      { id: "4", ts: Date.UTC(2026, 9, 3), type: "donation", amount: 100_00, code: "A" },
    ];
    const s = budgetSummary(txs, 60_00, at);
    assert.deepEqual([s.month, s.spent, s.remaining, s.over, s.count, s.people], ["2026-11", 70_00, 0, 10_00, 2, 2]);
    assert.deepEqual(s.months.slice(-2), [{ key: "2026-10", total: 100_00 }, { key: "2026-11", total: 70_00 }]);
  });
});
