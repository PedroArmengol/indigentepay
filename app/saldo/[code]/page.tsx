"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ErrorMsg, Pagina } from "@/components/ui";
import { api, errorText, fecha, pesos } from "@/lib/client";
import type { Tx } from "@/lib/types";

type Cuenta = { person: { alias: string; balance: number; received: number; redeemed: number; donations: number }; txs: Tx[] };

export default function Saldo() {
  const { code } = useParams<{ code: string }>();
  const [pin, setPin] = useState("");
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setCuenta(await api<Cuenta>(`/api/people/${code}`, { body: { pin } }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!cuenta) {
    return (
      <Pagina>
        <form onSubmit={submit} className="grid gap-5 pt-2">
          <div>
            <h1 className="text-4xl">Saldo del gafete {code}</h1>
            <p className="mt-3">Escribe el NIP de la persona para ver su saldo.</p>
          </div>
          <label>
            <span className="etiqueta">NIP</span>
            <input className="campo tracking-[0.5em]" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" autoFocus />
          </label>
          <ErrorMsg>{error}</ErrorMsg>
          <button className="btn btn-rosa" disabled={busy || pin.length !== 4}>{busy ? "Revisando…" : "Ver saldo"}</button>
        </form>
      </Pagina>
    );
  }

  const { person, txs } = cuenta;
  return (
    <Pagina>
      <div className="grid gap-5 pt-2">
        <section className="rotulo p-5">
          <p className="text-sm text-humo">Saldo de {person.alias}</p>
          <p className="mt-1 text-5xl font-extrabold tabular-nums tracking-tight">{pesos(person.balance)}</p>
          <p className="mt-3 text-sm">
            Ha recibido {pesos(person.received)} en {person.donations} {person.donations === 1 ? "donativo" : "donativos"} y ha gastado {pesos(person.redeemed)}.
          </p>
        </section>
        <section>
          <h2 className="text-xl">Movimientos</h2>
          {txs.length === 0 ? (
            <p className="nota mt-2">Todavía no hay donativos. Lleva el gafete a la vista para que lo escaneen.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {txs.map((t) => (
                <li key={t.id} className="hoja flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {t.type === "donation" ? `Donativo de ${t.donorName ?? "alguien"}` : `${t.merchant}${t.concept ? `: ${t.concept}` : ""}`}
                    </p>
                    <p className="text-xs text-humo">{fecha(t.ts)}</p>
                  </div>
                  <p className={`shrink-0 font-extrabold tabular-nums ${t.type === "donation" ? "text-verde" : ""}`}>
                    {t.type === "donation" ? "+" : "−"}{pesos(t.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Pagina>
  );
}
