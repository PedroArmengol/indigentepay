import { ok } from "@/lib/api";
import { DEMO_PEOPLE, DEMO_PIN, getStore, redisVarNames, storageKind } from "@/lib/core";
import { peyEnabled } from "@/lib/pey";

export async function GET() {
  const stats = await (await getStore()).stats();
  return ok({
    stats,
    storage: storageKind(),
    redisVars: redisVarNames(),
    funding: peyEnabled() ? "codi" : "simulado",
    demo: { pin: DEMO_PIN, people: DEMO_PEOPLE.map(({ code, alias, zone, need }) => ({ code, alias, zone, need })) },
  });
}
