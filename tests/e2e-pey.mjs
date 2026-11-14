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
// ---- Pago directo a un receptor: el cobro va referenciado a su gafete
const saldoDe = async (code) => (await call(`/api/people/${code}`, { pin: "1234" })).data.person;
const lupita0 = await saldoDe("LUPITA");
r = await call("/api/pay", { code: "NOEXISTE", amount: 15, method: "qr" });
assert.equal(r.status, 404);
r = await call("/api/pay", { code: "lupita", amount: 15, method: "qr" });
assert.deepEqual([r.status, r.data.pay.code, r.data.pay.method], [201, "LUPITA", "qr"]);
const p1 = r.data.pay.id;
assert.equal((await call(`/api/fund/${p1}`)).status, 404, "un pago directo no es un fondeo de wallet");
assert.equal((await call(`/api/pay/${p1}`)).data.pay.status, "PENDING");
await mock(`/_pay/${(await mock("/_last")).qr}`, {});
r = await call(`/api/pay/${p1}`);
assert.deepEqual([r.data.pay.status, r.data.pay.alias, r.data.pay.deposited], ["PAID", "Doña Lupita", false]);
assert.equal(r.data.pay.summary.spent, 1500, "cuenta para el presupuesto de quien paga");
await call(`/api/pay/${p1}`);
const lupita1 = await saldoDe("LUPITA");
assert.equal(lupita1.balance - lupita0.balance, 1500, "se abona al gafete una sola vez");
assert.equal((await call("/api/wallet")).data.donor.balance, 2100, "la wallet no se toca");

// Sin wallet y por cobro al celular, a una persona que recibe en su banco
wallet = "";
const carmen0 = await saldoDe("CARMEN");
r = await call("/api/pay", { code: "CARMEN", amount: 30, method: "pn", phone: "5512345678" });
assert.equal(r.status, 201);
await mock(`/_pay/${(await mock("/_last")).tx}`, {});
r = await call(`/api/pay/${r.data.pay.id}`);
assert.deepEqual([r.data.pay.status, r.data.pay.deposited, r.data.pay.summary], ["PAID", true, null]);
const carmen1 = await saldoDe("CARMEN");
assert.deepEqual([carmen1.balance, carmen1.paidOut - carmen0.paidOut], [0, 3000]);
assert.equal((await call("/api/stats")).data.stats.fundedReal - antes, 2100 + 1500 + 3000);
console.log("OK: fondeo CoDi (QR, celular y webhook) y pago directo referenciado al receptor");
