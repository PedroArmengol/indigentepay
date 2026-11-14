import { ok } from "@/lib/api";
import { DEMO_PEOPLE, DEMO_PIN, getStore, redisVarNames, storageKind } from "@/lib/core";
import { syncStaticPayments } from "@/lib/direct";
import { peyEnabled } from "@/lib/pey";

export async function GET() {
  await syncStaticPayments();
  const stats = await (await getStore()).stats();
  return ok({
    stats,
    storage: storageKind(),
    redisVars: redisVarNames(),
    funding: peyEnabled() ? "codi" : "simulado",
    demo: { pin: DEMO_PIN, people: DEMO_PEOPLE.map(({ code, alias, zone, need, payout }) => ({ code, alias, zone, need, payout })) },
  });
}
