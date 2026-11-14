"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gafete, Pagina, useOrigin } from "@/components/ui";
import { api, pesos } from "@/lib/client";
import type { Stats } from "@/lib/types";

const PASOS = [
  { t: "Fondea tu wallet", d: "Pones saldo una vez y decides cuánto quieres dar al mes." },
  { t: "Escanea el gafete", d: "Con la cámara de tu celular. Eliges el monto y listo: sin efectivo y sin pedirle datos a nadie." },
  { t: "La persona lo recibe", d: "Si ya tiene cuenta de banco, se le deposita ahí. Si no, le abrimos una cuenta básica y paga comida o medicinas con su gafete y su NIP." },
];

export default function Inicio() {
  const origin = useOrigin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [storage, setStorage] = useState("");
  useEffect(() => {
    api<{ stats: Stats; storage: string }>("/api/stats")
      .then((r) => {
        setStats(r.stats);
        setStorage(r.storage);
      })
      .catch(() => {});
  }, []);

  return (
    <Pagina>
      <section className="pt-4">
        <h1 className="text-[2.6rem]">«No traigo cambio» ya no es pretexto.</h1>
        <p className="mt-4 text-lg leading-snug">
          Escanea el gafete de una persona en situación de calle, dale desde tu wallet y lleva la cuenta de cuánto das
          al mes.
        </p>
      </section>

      <section className="mt-8 flex justify-center">
        <div className="-rotate-2">
          <Gafete persona={{ code: "LUPITA", alias: "Doña Lupita", zone: "Metro Insurgentes, salida Génova" }} origin={origin} qr={190} />
        </div>
      </section>
      <p className="nota mt-4 text-center">Este gafete funciona: escanéalo con tu celular.</p>

      <section className="mt-8 grid gap-3">
        <Link href="/wallet" className="btn btn-rosa">
          Abrir mi wallet
        </Link>
        <Link href="/registrar" className="btn">
          Registrar a una persona
        </Link>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl">Cómo funciona</h2>
        <ol className="mt-4 grid gap-3">
          {PASOS.map((p, i) => (
            <li key={p.t} className="hoja flex gap-4 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aviso font-extrabold border-2 border-tinta">
                {i + 1}
              </span>
              <div>
                <p className="font-bold">{p.t}</p>
                <p className="mt-1 text-[0.9375rem] leading-snug">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {stats ? (
        <section className="mt-10 grid grid-cols-3 gap-2 text-center">
          <Dato n={pesos(stats.donated)} t="donados" />
          <Dato n={String(stats.people)} t="personas con gafete" />
          <Dato n={pesos(stats.redeemed)} t="gastados en comercios" />
        </section>
      ) : null}

      <section className="mt-10 grid gap-3">
        <Link href="/canjear" className="btn btn-aviso">
          Soy comercio aliado: cobrar con gafete
        </Link>
        <Link href="/demo" className="btn">
          Ver la demo guiada
        </Link>
      </section>

      {storage === "memoria" ? (
        <p className="aviso-error mt-10">
          Sin base de datos conectada: los saldos viven en la memoria del servidor y se pueden borrar. Conecta Redis
          (Upstash) para la demo en vivo.
        </p>
      ) : null}

      <p className="nota mt-10">
        Proyecto del Cursor Hackathon México 2026. El fondeo de esta demo es simulado: no se mueve dinero real.
      </p>
    </Pagina>
  );
}

function Dato({ n, t }: { n: string; t: string }) {
  return (
    <div className="hoja px-2 py-3">
      <p className="text-xl font-extrabold tabular-nums leading-none">{n}</p>
      <p className="mt-1 text-xs leading-tight text-humo">{t}</p>
    </div>
  );
}
