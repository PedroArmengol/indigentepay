// Prueba de punta a punta contra un servidor en marcha: node tests/e2e.mjs http://localhost:3000
import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://localhost:3000";
let wallet = "";
async function call(path, body, method) {
  const res = await fetch(base + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", "x-wallet": wallet },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

let r = await call("/api/stats");
assert.equal(r.status, 200);
assert.equal(r.data.demo.people.length, 3);
console.log("almacén:", r.data.storage, "· fondeo:", r.data.funding);

r = await call("/api/wallet");
assert.equal(r.status, 401);
r = await call("/api/wallet", { name: "Pedro", budget: 100 });
assert.equal(r.status, 201);
wallet = r.data.donor.id;

r = await call("/api/donate", { code: "LUPITA", amount: 20 });
assert.equal(r.status, 402, "sin saldo no se puede donar");

r = await call("/api/fund", { amount: 5 });
assert.equal(r.status, 400);
r = await call("/api/fund", { amount: 200 });
assert.equal(r.status, 201);
const fundId = r.data.fund.id;
r = await call(`/api/fund/${fundId}`, {});
assert.equal(r.data.balance, 20000);
r = await call(`/api/fund/${fundId}`, {});
assert.deepEqual([r.data.balance, r.data.repeated], [20000, true], "confirmar dos veces no abona dos veces");

r = await call("/api/people", { alias: "Chuy", zone: "Tacuba", need: "Tacos", story: "", pin: "1234" });
assert.equal(r.status, 400, "NIP obvio rechazado");
r = await call("/api/people", { alias: "Chuy", zone: "Tacuba", need: "Tacos", story: "", pin: "4821" });
assert.equal(r.status, 201);
const code = r.data.code;

r = await call(`/api/people/${code.toLowerCase()}`);
assert.equal(r.data.person.alias, "Chuy");
assert.equal(r.data.person.balance, undefined, "el perfil público no muestra saldo");
assert.equal(r.data.person.pinHash, undefined);

r = await call("/api/donate", { code, amount: 70 });
assert.equal(r.status, 200);
assert.deepEqual([r.data.balance, r.data.summary.spent, r.data.summary.remaining], [13000, 7000, 3000]);
r = await call("/api/donate", { code: `${base}/p/${code}`, amount: 50 });
assert.deepEqual([r.data.balance, r.data.summary.over, r.data.summary.people], [8000, 2000, 1]);
r = await call("/api/donate", { code: "NOEXISTE", amount: 5 });
assert.equal(r.status, 404);
r = await call("/api/donate", { code, amount: 5000 });
assert.equal(r.status, 400);

r = await call("/api/wallet", { budget: 800 }, "PATCH");
assert.equal(r.data.budget, 80000);
r = await call("/api/wallet");
assert.deepEqual([r.data.donor.balance, r.data.summary.budget, r.data.txs.length], [8000, 80000, 3]);

r = await call(`/api/people/${code}`, { pin: "0000" });
assert.equal(r.status, 403);
r = await call(`/api/people/${code}`, { pin: "4821" });
assert.deepEqual([r.data.person.balance, r.data.txs.length], [12000, 2]);

r = await call("/api/redeem", { code, pin: "4821", amount: 85, merchant: "Fonda Mary", concept: "Comida corrida" });
assert.deepEqual([r.status, r.data.balance], [200, 3500]);
r = await call("/api/redeem", { code, pin: "4821", amount: 85, merchant: "Fonda Mary" });
assert.equal(r.status, 402, "no se gasta más de lo que hay");
for (let i = 0; i < 5; i++) r = await call("/api/redeem", { code, pin: "9999", amount: 1, merchant: "Fonda Mary" });
assert.equal(r.status, 403);
r = await call("/api/redeem", { code, pin: "4821", amount: 1, merchant: "Fonda Mary" });
assert.equal(r.status, 429, "gafete bloqueado tras 5 NIP incorrectos");

r = await call("/api/pey/webhook", { type: "codi.qr.payment_received" });
assert.equal(r.status, 401, "webhook sin firma rechazado");

console.log("OK: flujo completo", code);
