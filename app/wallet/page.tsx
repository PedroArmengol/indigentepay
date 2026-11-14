"use client";

import Link from "next/link";
import { useState } from "react";
import { Pagina, Presupuesto } from "@/components/ui";
import { CrearWallet } from "@/components/CrearWallet";
import { api, errorText, fecha, mesCorto, pesos, useWallet, type WalletData } from "@/lib/client";
import type { Tx } from "@/lib/types";

export default function Wallet() {
  const { status, data, reload } = useWallet();
  return (
    <Pagina accion={<Link href="/escanear" className="btn btn-chico">Escanear</Link>}>
      {status === "cargando" ? <p className="nota pt-8">Abriendo tu wallet…</p> : null}
      {status === "sin-wallet" ? <CrearWallet onDone={reload} /> : null}
      {status === "lista" && data ? <Panel data={data} reload={reload} /> : null}
    </Pagina>
  );
}

function Panel({ data, reload }: { data: WalletData; reload: () => unknown }) {
  const { donor, summary, txs } = data;
  const max = Math.max(...summary.months.map((m) => m.total), summary.budget, 1);
  return (
    <div className="grid gap-5 pt-2">
      <section className="rotulo p-5">
        <p className="text-sm text-humo">Saldo de {donor.name}</p>
        <p className="mt-1 text-5xl font-extrabold tabular-nums tracking-tight">{pesos(donor.balance)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link href="/wallet/fondear" className="btn">Fondear</Link>
          <Link href="/escanear" className="btn btn-rosa">Dar</Link>
        </div>
      </section>

      <section className="hoja p-5">
        <Presupuesto s={summary} />
        <p className="mt-3 text-sm">
          {summary.count === 0
            ? "Todavía no das nada este mes."
            : `Este mes ayudaste a ${summary.people} ${summary.people === 1 ? "persona" : "personas"} en ${summary.count} ${summary.count === 1 ? "donativo" : "donativos"}.`}
        </p>
        <CambiarPresupuesto actual={donor.budget} onDone={reload} />

        <div className="mt-5 flex h-24 items-end gap-2 border-b-2 border-tinta" aria-label="Lo que has dado en los últimos seis meses">
          {summary.months.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center justify-end" title={`${mesCorto(m.key)}: ${pesos(m.total)}`}>
              <div
                className={`w-full rounded-t-md border-2 border-b-0 border-tinta ${m.key === summary.month ? "bg-rosa" : "bg-aviso"}`}
                style={{ height: `${Math.max(m.total > 0 ? 6 : 0, (m.total / max) * 88)}px`, borderWidth: m.total > 0 ? undefined : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2 text-center text-xs text-humo">
          {summary.months.map((m) => (
            <span key={m.key} className="flex-1">{mesCorto(m.key)}</span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl">Movimientos</h2>
        {txs.length === 0 ? (
          <p className="nota mt-2">Aquí vas a ver cada fondeo y cada donativo. Empieza por fondear tu wallet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {txs.map((t) => <Movimiento key={t.id} t={t} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Movimiento({ t }: { t: Tx }) {
  const entra = t.type === "fund";
  return (
    <li className="hoja flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-bold">{entra ? "Fondeo" : `Para ${t.alias ?? t.code}`}</p>
        <p className="text-xs text-humo">{fecha(t.ts)}</p>
      </div>
      <p className={`shrink-0 font-extrabold tabular-nums ${entra ? "text-verde" : ""}`}>
        {entra ? "+" : "−"}{pesos(t.amount)}
      </p>
    </li>
  );
}

function CambiarPresupuesto({ actual, onDone }: { actual: number; onDone: () => unknown }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(actual / 100));
  const [error, setError] = useState("");
  if (!open) {
    return (
      <button className="mt-3 font-bold underline underline-offset-4" onClick={() => setOpen(true)}>
        Cambiar mi presupuesto
      </button>
    );
  }
  return (
    <form
      className="mt-3 flex items-start gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/api/wallet", { method: "PATCH", body: { budget: value } });
          setOpen(false);
          setError("");
          await onDone();
        } catch (err) {
          setError(errorText(err));
        }
      }}
    >
      <label className="flex-1">
        <span className="sr-only">Presupuesto mensual en pesos</span>
        <input className="campo" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} />
        {error ? <span className="mt-1 block text-sm font-semibold text-rosa">{error}</span> : null}
      </label>
      <button className="btn btn-chico mt-1.5">Guardar</button>
    </form>
  );
}
