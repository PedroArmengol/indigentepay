"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Gafete, Pagina, useOrigin, type Persona } from "@/components/ui";
import { api } from "@/lib/client";
import { CUENTA_NIVEL } from "@/lib/cuenta";

type Alta = { code: string; payout?: "clabe" | "n2bis"; curp?: string; account?: string; legalName?: string; bank?: string; clabeEnd?: string };

export default function VerGafete() {
  const { code } = useParams<{ code: string }>();
  const origin = useOrigin();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [alta, setAlta] = useState<Alta | null>(null);

  useEffect(() => {
    setNuevo(new URLSearchParams(window.location.search).has("nuevo"));
    try {
      const guardada = JSON.parse(window.sessionStorage.getItem("indigentepay.alta") ?? "null") as Alta | null;
      if (guardada?.code === code) setAlta(guardada);
    } catch {}
    api<{ person: Persona }>(`/api/people/${code}`).then((r) => setPersona(r.person)).catch(() => setNoExiste(true));
  }, [code]);

  if (noExiste) {
    return (
      <Pagina>
        <h1 className="pt-6 text-4xl">Este gafete no existe</h1>
        <Link href="/registrar" className="btn btn-rosa mt-5">Registrar a una persona</Link>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <div className="grid gap-5 pt-2">
        <div className="no-imprimir">
          <h1 className="text-4xl">{nuevo ? "Gafete listo" : "Gafete"}</h1>
          <p className="mt-3 leading-snug">
            Imprímelo y enmícalo. Quien lo escanee con la cámara de su celular puede darle dinero al instante.
          </p>
        </div>
        {alta?.payout === "n2bis" ? (
          <section className="no-imprimir hoja p-4">
            <p className="font-bold">Cuenta {CUENTA_NIVEL} abierta</p>
            <dl className="mt-2 grid gap-1 text-[0.9375rem]">
              <div className="flex justify-between gap-3"><dt className="text-humo">A nombre de</dt><dd className="text-right font-bold">{alta.legalName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-humo">CURP calculada</dt><dd className="font-bold tabular-nums">{alta.curp}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-humo">Cuenta</dt><dd className="font-bold tabular-nums">{alta.account}</dd></div>
            </dl>
            <p className="nota mt-3 leading-snug">
              Cuenta de demostración. En producción la abre un banco y la CURP se confirma con RENAPO. Lo que reciba se
              guarda aquí y lo gasta con su gafete y su NIP.
            </p>
          </section>
        ) : null}
        {alta?.payout === "clabe" ? (
          <section className="no-imprimir hoja p-4">
            <p className="font-bold">Recibe en su cuenta de {alta.bank} ••••{alta.clabeEnd}</p>
            <p className="nota mt-2 leading-snug">Cada donativo se le deposita al momento. En esta demo el depósito es simulado.</p>
          </section>
        ) : null}
        <div className="flex justify-center py-2">
          {persona ? <Gafete persona={persona} origin={origin} qr={230} /> : <p className="nota">Cargando gafete…</p>}
        </div>
        <div className="no-imprimir grid gap-3">
          <button className="btn btn-rosa" onClick={() => window.print()}>Imprimir gafete</button>
          <Link href={`/saldo/${code}`} className="btn">Consultar saldo con NIP</Link>
          <Link href={`/p/${code}`} className="btn">Ver lo que ve quien escanea</Link>
        </div>
      </div>
    </Pagina>
  );
}
