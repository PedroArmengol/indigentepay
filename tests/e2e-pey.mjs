// Fondeo CoDi contra la imitación de Pey: node tests/e2e-pey.mjs http://localhost:3000 http://127.0.0.1:8090
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const [base, pey] = [process.argv[2], process.argv[3]];
let wallet = "";
const call = async (path, body, method) => {
  const res = await fetch(base + path, { method: method ?? (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", "x-wallet": wallet }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
};
const mock = async (path, body) => (await fetch(pey + path, { method: body ? "POST" : "GET", body: body ? JSON.stringify(body) : undefined })).json();

let r = await call("/api/stats");
assert.equal(r.data.funding, "codi");
const antes = r.data.stats.fundedReal;
r = await call("/api/wallet", { name: "Pedro" });
wallet = r.data.donor.id;

// QR: pendiente hasta que Pey muestra el pago; no se puede "simular"
r = await call("/api/fund", { amount: 1, method: "qr" });
assert.deepEqual([r.status, r.data.fund.provider, r.data.fund.method, Boolean(r.data.fund.qrString)], [201, "pey", "qr", true]);
const f1 = r.data.fund.id;
assert.equal((await call(`/api/fund/${f1}`, {})).status, 409, "un fondeo real no se confirma a mano");
assert.equal((await call(`/api/fund/${f1}`)).data.fund.status, "PENDING");
await mock(`/_pay/${(await mock("/_last")).qr}`, {});
assert.equal((await call(`/api/fund/${f1}`)).data.fund.status, "PAID");
assert.equal((await call(`/api/fund/${f1}`)).data.fund.status, "PAID");
assert.equal((await call("/api/wallet")).data.donor.balance, 100, "se abona una sola vez");

// QR pagado por otro monto: no se abona
r = await call("/api/fund", { amount: 50, method: "qr" });
await mock(`/_pay/${(await mock("/_last")).qr}`, { amount: 5 });
assert.equal((await call(`/api/fund/${r.data.fund.id}`)).data.fund.status, "PENDING");

// Cobro al celular
assert.equal((await call("/api/fund", { amount: 20, method: "pn", phone: "55123" })).status, 400);
r = await call("/api/fund", { amount: 20, method: "pn", phone: "5512345678" });
assert.deepEqual([r.status, r.data.fund.method], [201, "pn"]);
const f3 = r.data.fund.id;
assert.equal((await call(`/api/fund/${f3}`)).data.fund.status, "PENDING");
const tx3 = (await mock("/_last")).tx;
await mock(`/_pay/${tx3}`, {});

// Webhook firmado (llega antes que la consulta de la pantalla)
const secret = "whsec_" + Buffer.from("secreto-de-prueba-de-32-bytes!!!").toString("base64");
const event = JSON.stringify({ type: "codi.pn.payment_received", transactionId: tx3, amount: 20, metadata: { externalMetadata: { orderId: f3 } } });
const ts = String(Math.floor(Date.now() / 1000));
const sig = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`msg_1.${ts}.${event}`).digest("base64");
const hook = (signature) => fetch(base + "/api/pey/webhook", { method: "POST", headers: { "webhook-id": "msg_1", "webhook-timestamp": ts, "webhook-signature": signature }, body: event });
assert.equal((await hook("v1,AAAA")).status, 401);
assert.deepEqual(await (await hook(`v1,${sig}`)).json(), { result: "ok" });
assert.deepEqual(await (await hook(`v1,${sig}`)).json(), { result: "already" });
assert.equal((await call("/api/wallet")).data.donor.balance, 2100);
assert.equal((await call("/api/stats")).data.stats.fundedReal - antes, 2100, "la concentradora suma solo lo recibido por CoDi");
console.log("OK: fondeo CoDi (QR, celular y webhook)");
