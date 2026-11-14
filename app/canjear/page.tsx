"use client";

import { useEffect, useState } from "react";
import { Scanner } from "@/components/Scanner";
import { ErrorMsg, Pagina, Sello } from "@/components/ui";
import { api, errorText, leerCodigo, pesos } from "@/lib/client";

type Cobro = { tx: { amount: number }; balance: number; alias: string };
const KEY = "indigentepay.comercio";

export default function Canjear() {
  const [merchant, setMerchant] = useState("");
  const [code, setCode] = useState("");
  const [alias, setAlias] = useState("");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [pin, setPin] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cobro, setCobro] = useState<Cobro | null>(null);

  useEffect(() => {
    try {
      setMerchant(window.localStorage.getItem(KEY) ?? "");
    } catch {}
  }, []);

  // Al tener un código completo, mostramos de quién es el gafete
  useEffect(() => {
    setAlias("");
    if (code.length < 4) return;
    let vivo = true;
    api<{ person: { alias: string } }>(`/api/people/${code}`).then((r) => vivo && setAlias(r.person.alias)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [code]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      window.localStorage.setItem(KEY, merchant);
    } catch {}
    try {
      setCobro(await api<Cobro>("/api/redeem", { body: { code, pin, amount, merchant, concept } }));
    } catch (err) {
      setError(errorText(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  if (cobro) {
    return (
      <Pagina>
        <div className="grid gap-5 pt-6 text-center">
          <Sello>Cobro<br />aprobado</Sello>
          <h1 className="text-4xl">Cobraste {pesos(cobro.tx.amount)}</h1>
          <p>
            A {cobro.alias} le quedan {pesos(cobro.balance)} en su gafete.
          </p>
          <button
            className="btn btn-rosa"
            onClick={() => {
              setCobro(null);
              setCode("");
              setAmount("");
              setConcept("");
              setPin("");
            }}
          >
            Hacer otro cobro
          </button>
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <form onSubmit={submit} className="grid gap-5 pt-2">
        <div>
          <h1 className="text-4xl">Cobrar con gafete</h1>
          <p className="mt-3 leading-snug">Para comercios aliados: la persona paga con el saldo de su gafete y confirma con su NIP.</p>
        </div>
        <label>
          <span className="etiqueta">Tu comercio</span>
          <input className="campo" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Ej. Fonda Doña Mary" required minLength={2} maxLength={40} />
        </label>

        <div>
          <span className="etiqueta">Gafete</span>
          {scan ? (
            <Scanner
              onCode={(t) => {
                setCode(leerCodigo(t));
                setScan(false);
              }}
            />
          ) : (
            <div className="flex gap-2">
              <input className="campo uppercase" value={code} onChange={(e) => setCode(leerCodigo(e.target.value))} placeholder="Código" aria-label="Código del gafete" required />
              <button type="button" className="btn btn-aviso shrink-0" style={{ width: "auto" }} onClick={() => setScan(true)}>
                Escanear
              </button>
            </div>
          )}
          {alias ? <p className="mt-2 font-bold">Gafete de {alias}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="etiqueta">Monto</span>
            <input className="campo" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="$" required />
          </label>
          <label>
            <span className="etiqueta">Qué compró</span>
            <input className="campo" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Comida corrida" maxLength={60} />
          </label>
        </div>

        <label>
          <span className="etiqueta">NIP (lo teclea la persona)</span>
          <input className="campo tracking-[0.5em]" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" required />
        </label>

        <ErrorMsg>{error}</ErrorMsg>
        <button className="btn btn-rosa" disabled={busy || code.length < 4 || pin.length !== 4 || !Number(amount) || merchant.trim().length < 2}>
          {busy ? "Cobrando…" : `Cobrar ${Number(amount) ? pesos(Math.round(Number(amount) * 100)) : ""}`}
        </button>
      </form>
    </Pagina>
  );
}
