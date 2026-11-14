"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ErrorMsg, Pagina } from "@/components/ui";
import { api, errorText, fecha, pesos } from "@/lib/client";
import { CUENTA_NIVEL } from "@/lib/cuenta";
import type { Tx } from "@/lib/types";

type Cuenta = {
  person: {
    alias: string; balance: number; received: number; redeemed: number; paidOut: number; donations: number;
    payout?: "clabe" | "n2bis"; legalName?: string; curp?: string; account?: string; bank?: string; clabeEnd?: string;
  };
  txs: Tx[];
};

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
  const enBanco = person.payout === "clabe";
  const donativos = `${person.donations} ${person.donations === 1 ? "donativo" : "donativos"}`;
  return (
    <Pagina>
      <div className="grid gap-5 pt-2">
        <section className="rotulo p-5">
          <p className="text-sm text-humo">
            {enBanco ? `Depositado a ${person.alias} en ${person.bank} ••••${person.clabeEnd}` : `Saldo de ${person.alias}`}
          </p>
          <p className="mt-1 text-5xl font-extrabold tabular-nums tracking-tight">{pesos(enBanco ? person.paidOut : person.balance)}</p>
          <p className="mt-3 text-sm">
            {enBanco
              ? `Ha recibido ${pesos(person.received)} en ${donativos}. Cada uno se deposita a su cuenta al momento.`
              : `Ha recibido ${pesos(person.received)} en ${donativos} y ha gastado ${pesos(person.redeemed)}.`}
          </p>
        </section>

        {person.payout === "n2bis" ? (
          <section className="hoja p-4">
            <p className="font-bold">Cuenta {CUENTA_NIVEL}</p>
            <dl className="mt-2 grid gap-1 text-[0.9375rem]">
              <div className="flex justify-between gap-3"><dt className="text-humo">A nombre de</dt><dd className="text-right font-bold">{person.legalName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-humo">CURP calculada</dt><dd className="font-bold tabular-nums">{person.curp}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-humo">Cuenta</dt><dd className="font-bold tabular-nums">{person.account}</dd></div>
            </dl>
            <p className="nota mt-2">Cuenta de demostración.</p>
          </section>
        ) : null}

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
                      {t.type === "donation"
                        ? `Donativo de ${t.donorName ?? "alguien"}`
                        : t.type === "payout"
                          ? t.merchant
                          : `${t.merchant}${t.concept ? `: ${t.concept}` : ""}`}
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
