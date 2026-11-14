"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CrearWallet } from "@/components/CrearWallet";
import { PagoCodi } from "@/components/PagoCodi";
import { ErrorMsg, Montos, Pagina, Presupuesto, Sello, type Persona } from "@/components/ui";
import { ApiError, api, errorText, pesos, useWallet, type Summary } from "@/lib/client";

type Hecho = { amount: number; balance?: number; summary?: Summary | null; deposited?: boolean; directo?: boolean };

export default function Pagar() {
  const { code } = useParams<{ code: string }>();
  const wallet = useWallet();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [codi, setCodi] = useState(false);
  const [amount, setAmount] = useState("20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<Hecho | null>(null);

  useEffect(() => {
    api<{ person: Persona }>(`/api/people/${code}`).then((r) => setPersona(r.person)).catch(() => setNoExiste(true));
    api<{ funding: string }>("/api/stats").then((r) => setCodi(r.funding === "codi")).catch(() => {});
  }, [code]);

  const cents = Math.round((Number(amount) || 0) * 100);
  const saldo = wallet.data?.donor.balance ?? 0;
  const falta = wallet.status === "lista" && cents > saldo;

  async function dar() {
    setBusy(true);
    setError("");
    try {
      const res = await api<Hecho & { tx: { amount: number } }>("/api/donate", { body: { code, amount } });
      setHecho({ amount: res.tx.amount, balance: res.balance, summary: res.summary, deposited: res.deposited });
    } catch (err) {
      setError(errorText(err));
      if (err instanceof ApiError && err.status === 402) void wallet.reload();
    } finally {
      setBusy(false);
    }
  }

  if (noExiste) {
    return (
      <Pagina>
        <div className="grid gap-4 pt-6">
          <h1 className="text-4xl">Este gafete no existe</h1>
          <p>Revisa el código impreso o vuelve a escanear el QR.</p>
          <Link href="/escanear" className="btn btn-rosa">Escanear otra vez</Link>
        </div>
      </Pagina>
    );
  }

  if (hecho && persona) {
    return (
      <Pagina>
        <div className="grid gap-5 pt-6">
          <Sello>Donativo<br />entregado</Sello>
          <h1 className="text-center text-4xl">
            Le diste {pesos(hecho.amount)} a {persona.alias}
          </h1>
          <p className="text-center">
            {hecho.directo ? `Tu pago CoDi llegó referenciado a su gafete ${persona.code}. ` : ""}
            {hecho.deposited ? "Ya se depositó a su cuenta de banco." : "Ya puede usarlo con su gafete en un comercio aliado."}
          </p>
          {hecho.summary ? (
            <div className="hoja p-5">
              <Presupuesto s={hecho.summary} />
              {hecho.balance !== undefined ? <p className="mt-3 text-sm">Saldo en tu wallet: {pesos(hecho.balance)}</p> : null}
            </div>
          ) : null}
          <Link href="/wallet" className="btn btn-rosa">{hecho.summary ? "Ver mi wallet" : "Abrir mi wallet y llevar mi presupuesto"}</Link>
          <Link href="/escanear" className="btn">Escanear otro gafete</Link>
        </div>
      </Pagina>
    );
  }

  const botonWallet = falta ? (
    <div className="grid gap-3">
      <p className="aviso-error">
        Tienes {pesos(saldo)} en tu wallet. Te faltan {pesos(cents - saldo)} para este donativo.
      </p>
      <Link href={`/wallet/fondear?volver=/p/${code}`} className={codi ? "btn" : "btn btn-rosa"}>
        Fondear mi wallet
      </Link>
    </div>
  ) : (
    <div>
      <button className={codi ? "btn" : "btn btn-rosa"} onClick={dar} disabled={busy || cents <= 0 || wallet.status !== "lista"}>
        {busy ? "Enviando…" : `Dar ${cents > 0 ? pesos(cents) : ""} ${codi ? "desde mi wallet" : `a ${persona?.alias ?? ""}`}`}
      </button>
      {wallet.data ? <p className="nota mt-3 text-center">Saldo en tu wallet: {pesos(saldo)}</p> : null}
    </div>
  );

  return (
    <Pagina>
      {!persona ? (
        <p className="nota pt-8">Buscando el gafete…</p>
      ) : (
        <div className="grid gap-5 pt-2">
          <section className="rotulo overflow-hidden">
            <div className="flex h-9 items-center justify-center border-b-2 border-tinta bg-aviso">
              <span className="h-2.5 w-10 rounded-full border-2 border-tinta bg-papel" />
            </div>
            <div className="p-5">
              <p className="text-sm text-humo">Vas a ayudar a</p>
              <h1 className="mt-1 text-4xl">{persona.alias}</h1>
              {persona.zone ? <p className="mt-2 text-[0.9375rem]">{persona.zone}</p> : null}
              {persona.story ? <p className="mt-3 leading-snug">{persona.story}</p> : null}
              {persona.need ? (
                <p className="mt-3 leading-snug">
                  <span className="font-bold">Lo que necesita:</span> {persona.need}
                </p>
              ) : null}
              <p className="mt-3 text-sm text-humo">
                {persona.payout === "clabe" ? "Tu donativo se deposita directo a su cuenta de banco." : "Tu donativo llega a su gafete; lo gasta en comercios aliados."}
              </p>
            </div>
          </section>

          {!codi && wallet.status === "sin-wallet" ? (
            <CrearWallet onDone={wallet.reload} titulo="Abre tu wallet para dar" />
          ) : (
            <>
              <section>
                <h2 className="mb-3 text-xl">¿Cuánto le quieres dar?</h2>
                <Montos value={amount} onChange={setAmount} opciones={[10, 20, 50, 100]} />
              </section>

              {wallet.data && cents > 0 ? (
                <section className="hoja p-4">
                  <Presupuesto s={wallet.data.summary} extra={cents} />
                </section>
              ) : null}

              <ErrorMsg>{error}</ErrorMsg>

              {codi ? (
                <>
                  <section className="grid gap-3">
                    <h2 className="text-xl">Paga directo desde tu banco</h2>
                    <PagoCodi code={persona.code} cents={cents} onPaid={(r) => setHecho({ ...r, directo: true })} />
                  </section>
                  <section className="grid gap-3">
                    <h2 className="text-xl">O usa el saldo de tu wallet</h2>
                    {wallet.status === "sin-wallet" ? (
                      <Link href="/wallet" className="btn">Abrir mi wallet</Link>
                    ) : (
                      botonWallet
                    )}
                  </section>
                </>
              ) : (
                botonWallet
              )}
            </>
          )}
        </div>
      )}
    </Pagina>
  );
}
