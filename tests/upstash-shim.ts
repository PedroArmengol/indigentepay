// Imitación mínima de la API REST de Upstash sobre un redis-server local (solo pruebas).
import http from "node:http";
import Redis from "ioredis";

export function startShim(redisPort: number, httpPort: number) {
  const redis = new Redis(redisPort);
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      try {
        const [name, ...args] = JSON.parse(raw) as string[];
        const result = await redis.call(name, ...args.map(String));
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ result }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: String(err) }));
      }
    });
  });
  server.listen(httpPort);
  return { close: () => { server.close(); redis.disconnect(); }, flush: () => redis.flushall() };
}
