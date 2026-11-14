"use client";

import { useState } from "react";
import { ErrorMsg } from "@/components/ui";
import { createWallet, errorText } from "@/lib/client";

export function CrearWallet({ onDone, titulo = "Abre tu wallet" }: { onDone: () => unknown; titulo?: string }) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState(500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createWallet(name, budget);
      await onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 pt-4">
      <div>
        <h1 className="text-4xl">{titulo}</h1>
        <p className="mt-3 leading-snug">Sin contraseña ni registro: la wallet vive en este celular.</p>
      </div>
      <label>
        <span className="etiqueta">¿Cómo te llamas?</span>
        <input className="campo" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="given-name" required minLength={2} maxLength={40} />
      </label>
      <fieldset>
        <legend className="etiqueta">¿Cuánto quieres dar al mes?</legend>
        <div className="grid grid-cols-4 gap-2">
          {[200, 500, 1000, 2000].map((o) => (
            <button key={o} type="button" className="ficha" aria-pressed={budget === o} onClick={() => setBudget(o)}>
              ${o.toLocaleString("es-MX")}
            </button>
          ))}
        </div>
        <p className="nota mt-2">Es tu meta personal. La puedes cambiar cuando quieras.</p>
      </fieldset>
      <ErrorMsg>{error}</ErrorMsg>
      <button className="btn btn-rosa" disabled={busy || name.trim().length < 2}>
        {busy ? "Creando…" : "Crear mi wallet"}
      </button>
    </form>
  );
}
