import { NextResponse } from "next/server";
import { getStore } from "./core";
import type { Donor } from "./types";

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const data = await req.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** La llave de la wallet viaja en el header x-wallet. */
export async function walletFrom(req: Request): Promise<Donor | null> {
  const id = req.headers.get("x-wallet") ?? "";
  if (!/^d_[a-f0-9]{24}$/.test(id)) return null;
  return (await getStore()).getDonor(id);
}
