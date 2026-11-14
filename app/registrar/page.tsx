"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorMsg, Pagina } from "@/components/ui";
import { api, errorText } from "@/lib/client";

export default function Registrar() {
  const router = useRouter();
  const [f, setF] = useState({ alias: "", zone: "", need: "", story: "", pin: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ code: string }>("/api/people", { body: f });
      router.push(`/gafete/${res.code}?nuevo=1`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Pagina>
      <form onSubmit={submit} className="grid gap-5 pt-2">
        <div>
          <h1 className="text-4xl">Registra a una persona</h1>
          <p className="mt-3 leading-snug">
            Hazlo junto con ella. Al terminar imprimes su gafete: con él recibe donativos y paga en comercios aliados.
          </p>
        </div>
        <label>
          <span className="etiqueta">Nombre o apodo</span>
          <input className="campo" value={f.alias} onChange={set("alias")} placeholder="Como quiere que le digan" required minLength={2} maxLength={40} />
        </label>
        <label>
          <span className="etiqueta">Dónde suele estar</span>
          <input className="campo" value={f.zone} onChange={set("zone")} placeholder="Ej. Metro Hidalgo, salida a la Alameda" maxLength={60} />
        </label>
        <label>
          <span className="etiqueta">Qué necesita</span>
          <input className="campo" value={f.need} onChange={set("need")} placeholder="Ej. Comida y sus medicinas" maxLength={80} />
        </label>
        <label>
          <span className="etiqueta">Su historia, en sus palabras</span>
          <textarea className="campo" rows={3} value={f.story} onChange={set("story")} maxLength={240} placeholder="Opcional. Solo lo que la persona quiera contar." />
        </label>
        <label>
          <span className="etiqueta">NIP de 4 dígitos</span>
          <input
            className="campo tracking-[0.5em]" value={f.pin} inputMode="numeric" pattern="\d{4}" maxLength={4} required placeholder="••••"
            onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "") })}
          />
          <span className="nota mt-2 block">Lo elige la persona y solo ella lo debe saber. Lo usa para pagar con su saldo.</span>
        </label>
        <label className="flex gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-rosa" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="text-[0.9375rem] leading-snug">La persona está de acuerdo en que su nombre e historia aparezcan cuando alguien escanee su gafete.</span>
        </label>
        <ErrorMsg>{error}</ErrorMsg>
        <button className="btn btn-rosa" disabled={busy || !consent || f.alias.trim().length < 2 || f.pin.length !== 4}>
          {busy ? "Creando gafete…" : "Crear gafete"}
        </button>
      </form>
    </Pagina>
  );
}
