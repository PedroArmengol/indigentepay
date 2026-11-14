"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState, type ReactNode } from "react";
import { pesos, type Summary, mesLargo } from "@/lib/client";

export function Marca() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-xl tracking-tight">
      <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#e6007e" />
        <path fill="#fff" d="M14 14h16v16H14zM34 14h6v6h-6zM44 14h6v16h-6zM34 24h6v6h-6zM14 34h6v6h-6zM24 34h6v16h-6zM14 44h6v6h-6zM34 34h16v16H34z" />
        <path fill="#e6007e" d="M19 19h6v6h-6zM39 39h6v6h-6z" />
      </svg>
      IndigentePay
    </Link>
  );
}

export function Pagina({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-5 pb-16">
      <header className="no-imprimir flex items-center justify-between py-4">
        <Marca />
        {accion ?? (
          <Link href="/wallet" className="btn btn-chico">
            Mi wallet
          </Link>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}

export function QR({ value, size = 220 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M", color: { dark: "#17123b", light: "#ffffff" } })
      .then((url) => vivo && setSrc(url))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [value, size]);
  return (
    <div style={{ width: size, height: size }} className="bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} width={size} height={size} alt="Código QR del gafete" /> : null}
    </div>
  );
}

export type Persona = { code: string; alias: string; zone?: string; need?: string; story?: string };

/** El gafete: la cuenta de la persona, impresa. */
export function Gafete({ persona, origin, qr = 200 }: { persona: Persona; origin: string; qr?: number }) {
  return (
    <div className="rotulo overflow-hidden" style={{ width: qr + 64 }}>
      <div className="flex h-11 items-center justify-center border-b-2 border-tinta bg-aviso">
        <span className="h-3 w-12 rounded-full border-2 border-tinta bg-papel" />
      </div>
      <div className="px-6 pb-5 pt-4">
        <p className="text-sm text-humo">Hola, soy</p>
        <p className="text-[1.75rem] font-extrabold leading-none tracking-tight">{persona.alias}</p>
        {persona.zone ? <p className="mt-1 text-sm leading-snug">{persona.zone}</p> : null}
        <div className="my-3 inline-block rounded-xl border-2 border-tinta p-1 align-top">
          {origin ? <QR value={`${origin}/p/${persona.code}`} size={qr} /> : <div style={{ width: qr, height: qr }} />}
        </div>
        <p className="font-bold leading-tight">Escanea con tu cámara para ayudarme</p>
        <p className="mt-1 text-xs text-humo">
          Sin efectivo, con IndigentePay. Gafete {persona.code}
        </p>
      </div>
    </div>
  );
}

export function useOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

export function Montos({ value, onChange, opciones }: { value: string; onChange: (v: string) => void; opciones: number[] }) {
  const esOpcion = opciones.includes(Number(value));
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {opciones.map((o) => (
          <button key={o} type="button" className="ficha" aria-pressed={Number(value) === o} onClick={() => onChange(String(o))}>
            ${o}
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="etiqueta">Otro monto</span>
        <input
          className="campo" inputMode="decimal" placeholder="$" value={esOpcion ? "" : value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        />
      </label>
    </div>
  );
}

/** Barra del presupuesto mensual. `extra` muestra cómo quedaría con un donativo por hacer. */
export function Presupuesto({ s, extra = 0 }: { s: Summary; extra?: number }) {
  const total = s.spent + extra;
  const pct = s.budget > 0 ? Math.min(100, (s.spent / s.budget) * 100) : 0;
  const pctExtra = s.budget > 0 ? Math.min(100 - pct, (extra / s.budget) * 100) : 0;
  const pasado = total > s.budget;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold leading-tight">Presupuesto de {mesLargo(s.month)}</p>
        <p className="shrink-0 whitespace-nowrap text-sm tabular-nums">
          {pesos(total)} de {pesos(s.budget)}
        </p>
      </div>
      <div
        className="mt-2 flex h-5 overflow-hidden rounded-full border-2 border-tinta bg-white" role="progressbar"
        aria-valuemin={0} aria-valuemax={s.budget / 100} aria-valuenow={Math.min(total, s.budget) / 100}
      >
        <div className={pasado ? "bg-rosa" : "bg-verde"} style={{ width: `${pct}%` }} />
        {extra > 0 ? <div className="bg-aviso" style={{ width: `${pctExtra}%` }} /> : null}
      </div>
      <p className="mt-2 text-sm">
        {pasado
          ? `Te pasas ${pesos(total - s.budget)} de lo que te propusiste dar este mes.`
          : `Te quedan ${pesos(s.budget - total)} para dar este mes.`}
      </p>
    </div>
  );
}

export function ErrorMsg({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="aviso-error" role="alert">
      {children}
    </p>
  );
}

export function Sello({ children }: { children: ReactNode }) {
  return (
    <div className="sello mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[3px] border-verde text-center text-sm font-extrabold uppercase leading-none tracking-wide text-verde">
      {children}
    </div>
  );
}
