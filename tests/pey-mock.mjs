// Imitación mínima de la API de Pey para probar el fondeo CoDi sin mover dinero.
// node tests/pey-mock.mjs 8090   → luego PEY_BASE_URL=http://127.0.0.1:8090 PEY_API_KEY=prueba
import http from "node:http";

const port = Number(process.argv[2] ?? 8090);
const txs = new Map(); // id → transacción
const qrs = new Map(); // idQr → { amount, metadata }
let n = 0;
const send = (res, code, body) => res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(body));

http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, "http://x");
    if (!url.pathname.startsWith("/_") && req.headers.authorization !== "Bearer prueba") return send(res, 401, { error: { message: "llave inválida" } });
    if (req.method === "POST" && url.pathname === "/codi/qr") {
      if (body.expiration && body.expiration < 360) return send(res, 400, { error: { message: "expiration" } });
      if (!/^[0-9]{1,7}$/.test(body.numRef ?? "0")) return send(res, 400, { error: { message: "numRef" } });
      const id = "qr" + ++n;
      qrs.set(id, body);
      return send(res, 201, { id, qrString: `{"TYP":1,"IDC":"${id}"}`, qrImage: null });
    }
    if (req.method === "POST" && url.pathname === "/codi/pn") {
      if (!/^\d{10}$/.test(body.phoneNumber ?? "")) return send(res, 400, { error: { message: "phoneNumber" } });
      const id = "01TX" + ++n;
      txs.set(id, { id, status: "PENDING", amount: body.amount, payableType: "API_CODI_PN", metadata: { externalMetadata: body.metadata } });
      return send(res, 201, { transactionId: id, codiId: "1".repeat(20) });
    }
    if (req.method === "GET" && url.pathname === "/transaction/api-key") {
      return send(res, 200, { items: [...txs.values()].reverse(), nextToken: null });
    }
    if (req.method === "GET" && url.pathname.startsWith("/transaction/")) {
      const tx = txs.get(url.pathname.split("/")[2]);
      return tx ? send(res, 200, tx) : send(res, 404, { error: { message: "Transaction not found" } });
    }
    // Control de la prueba: marcar como pagado un QR o un cobro
    if (req.method === "POST" && url.pathname.startsWith("/_pay/")) {
      const ref = url.pathname.split("/")[2];
      if (qrs.has(ref)) {
        const q = qrs.get(ref);
        const id = "01TX" + ++n;
        txs.set(id, {
          id, status: "PAID", amount: body.amount ?? q.amount, amountBreakdown: { base: body.amount ?? q.amount, tip: 0, fee: 0 },
          payableType: "API_CODI_QR", payableId: ref, datePaid: 1, metadata: { clabe: "0".repeat(18), externalMetadata: q.metadata },
        });
        return send(res, 200, { transactionId: id });
      }
      const tx = txs.get(ref);
      if (tx) {
        tx.status = "PAID";
        return send(res, 200, { transactionId: ref });
      }
    }
    if (req.method === "GET" && url.pathname === "/_last") return send(res, 200, { qr: [...qrs.keys()].pop(), tx: [...txs.keys()].pop() });
    send(res, 404, { error: { message: "no existe" } });
  });
}).listen(port);
