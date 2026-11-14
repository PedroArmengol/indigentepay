"use client";

import { useCallback, useEffect, useState } from "react";
import type { Donor, Tx } from "./types";

const KEY = "indigentepay.wallet";

export function walletId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function saveWallet(id: string) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {}
}
export function clearWallet() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", "x-wallet": walletId() ?? "" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Sin conexión. Revisa tu internet e intenta de nuevo.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Algo falló. Intenta de nuevo.", res.status, data);
  return data as T;
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : "Algo falló. Intenta de nuevo.");

export function pesos(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  }).format(cents / 100);
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const mesLargo = (key: string) => MESES[Number(key.slice(5, 7)) - 1] ?? key;
export const mesCorto = (key: string) => mesLargo(key).slice(0, 3);

export function fecha(ts: number): string {
  return new Date(ts).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export type Summary = {
  month: string; budget: number; spent: number; remaining: number; over: number; count: number; people: number;
  months: { key: string; total: number }[];
};
export type WalletData = { donor: Donor; summary: Summary; txs: Tx[] };

export function useWallet() {
  const [status, setStatus] = useState<"cargando" | "sin-wallet" | "lista">("cargando");
  const [data, setData] = useState<WalletData | null>(null);

  const reload = useCallback(async () => {
    if (!walletId()) {
      setStatus("sin-wallet");
      return null;
    }
    try {
      const fresh = await api<WalletData>("/api/wallet");
      setData(fresh);
      setStatus("lista");
      return fresh;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) clearWallet();
      setStatus("sin-wallet");
      return null;
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { status, data, reload };
}

export async function createWallet(name: string, budgetPesos: number) {
  const res = await api<{ donor: Donor }>("/api/wallet", { body: { name, budget: budgetPesos } });
  saveWallet(res.donor.id);
  return res.donor;
}

/** Saca el código del gafete de un QR (URL) o de lo que la persona escribió. */
export function leerCodigo(texto: string): string {
  const t = texto.trim();
  const url = t.match(/\/(?:p|gafete|saldo)\/([A-Za-z0-9]{4,12})/);
  return (url ? url[1] : t).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}
