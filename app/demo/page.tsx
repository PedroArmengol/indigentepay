"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gafete, Pagina, useOrigin } from "@/components/ui";
import { api, pesos } from "@/lib/client";

type Info = {
  stats: { fundedReal: number; donated: number; redeemed: number; paidOut: number; people: number; donors: number };
  storage: "redis" | "memoria";
  funding: "codi" | "simulado";
  demo: { pin: string; people: { code: string; alias: string; zone: string; need: string; payout?: "clabe" | "n2bis" }[] };
};

const PASOS = [
  { t: "Abre tu wallet y fondéala", d: "Pon tu nombre, elige tu presupuesto del mes y fondea: con CoDi real si está activado, o con un pago simulado.", href: "/wallet", cta: "Abrir wallet" },
  { t: "Escanea un gafete y da", d: "Con CoDi activado, escanea un gafete de abajo con la app de tu banco y pon el monto. Sin CoDi, usa la cámara del celular.", href: "/escanear", cta: "Escanear" },
  { t: "Cobra como comercio aliado", d: "Escribe el código del gafete, un monto y el NIP de demostración.", href: "/canjear", cta: "Cobrar con gafete" },
  { t: "Registra a alguien nuevo", d: "Prueba las dos opciones: con cuenta de banco (CLABE) o sin cuenta, abriéndole una cuenta básica con su CURP calculada.", href: "/registrar", cta: "Registrar" },
];

export default function Demo() {
  const origin = useOrigin();
  const [info, setInfo] = useState<Info | null>(null);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  useEffect(() => {
    api<Info>("/api/stats")
      .then((r) => {
        setInfo(r);
        for (const p of r.demo.people) {
          api<{ person: { codiQr?: string } }>(`/api/people/${p.code}`)
            .then((x) => x.person.codiQr && setQrs((q) => ({ ...q, [p.code]: x.person.codiQr! })))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Pagina>
      <div className="pt-2">
        <h1 className="text-4xl">Demo guiada</h1>
        <p className="mt-3 leading-snug">El ciclo completo en dos minutos: fondear, dar, gastar.</p>
      </div>

      <ol className="mt-6 grid gap-3">
        {PASOS.map((p, i) => (
          <li key={p.t} className="hoja p-4">
            <div className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-tinta bg-aviso font-extrabold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{p.t}</p>
                <p className="mt-1 text-[0.9375rem] leading-snug">{p.d}</p>
                <Link href={p.href} className="btn btn-chico mt-3">{p.cta}</Link>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-2xl">Gafetes de demostración</h2>
      <p className="mt-2">
        NIP de todos: <span className="font-extrabold tabular-nums">{info?.demo.pin ?? "…"}</span>
      </p>
      <div className="mt-5 grid justify-items-center gap-8">
        {(info?.demo.people ?? []).map((p) => (
          <div key={p.code} className="grid justify-items-center gap-3">
            <Gafete persona={{ ...p, codiQr: qrs[p.code] }} origin={origin} qr={200} />
            <p className="text-sm font-bold">{p.payout === "clabe" ? "Recibe en su cuenta de banco" : "Sin cuenta de banco: recibe en su gafete"}</p>
            <div className="flex gap-2">
              <Link href={`/p/${p.code}`} className="btn btn-chico">Abrir sin escanear</Link>
              <Link href={`/saldo/${p.code}`} className="btn btn-chico">Ver saldo</Link>
            </div>
          </div>
        ))}
      </div>

      {info ? (
        <section className="hoja mt-10 p-4">
          <h2 className="text-xl">Cuenta concentradora</h2>
          <p className="mt-2 text-[0.9375rem] leading-snug">
            {info.funding === "codi"
              ? "Los pagos CoDi llegan a una sola cuenta bancaria. IndigentePay lleva el libro: cada wallet y cada gafete es una subcuenta."
              : "Con CoDi activado, los pagos llegan a una sola cuenta bancaria y IndigentePay lleva el libro de subcuentas."}
          </p>
          <dl className="mt-3 grid gap-1 text-[0.9375rem]">
            <div className="flex justify-between gap-3"><dt>Recibido por CoDi</dt><dd className="font-extrabold tabular-nums">{pesos(info.stats.fundedReal)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Subcuentas de donantes (wallets)</dt><dd className="font-extrabold tabular-nums">{info.stats.donors}</dd></div>
            <div className="flex justify-between gap-3"><dt>Subcuentas de personas (gafetes)</dt><dd className="font-extrabold tabular-nums">{info.stats.people}</dd></div>
            <div className="flex justify-between gap-3"><dt>Entregado a gafetes</dt><dd className="font-extrabold tabular-nums">{pesos(info.stats.donated)}</dd></div>
          </dl>
        </section>
      ) : null}

      {info ? (
        <p className="nota mt-10">
          Datos guardados en {info.storage === "redis" ? "Redis" : "memoria (se borran al reiniciar el servidor)"}. Fondeo{" "}
          {info.funding === "codi" ? "con CoDi real vía Pey" : "simulado: no se mueve dinero real"}. Las personas de los gafetes de
          demostración son ficticias.
        </p>
      ) : null}
    </Pagina>
  );
}
