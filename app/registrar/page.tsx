"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorMsg, Pagina } from "@/components/ui";
import { bancoDeClabe, clabeValida } from "@/lib/clabe";
import { api, errorText } from "@/lib/client";
import { CUENTA_NIVEL } from "@/lib/cuenta";
import { ESTADOS, calcularCurp } from "@/lib/curp";

type Recibe = "" | "clabe" | "n2bis";

export default function Registrar() {
  const router = useRouter();
  const [f, setF] = useState({ alias: "", zone: "", need: "", story: "", pin: "" });
  const [recibe, setRecibe] = useState<Recibe>("");
  const [clabe, setClabe] = useState("");
  const [id, setId] = useState({ names: "", surname1: "", surname2: "", birth: "", sex: "", state: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const setI = (k: keyof typeof id) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setId({ ...id, [k]: e.target.value });

  const curp = recibe === "n2bis" ? calcularCurp({ ...id, sex: id.sex as "H" | "M" | "X" }) : null;
  const clabeOk = clabeValida(clabe);
  const cuentaLista = recibe === "clabe" ? clabeOk : recibe === "n2bis" ? Boolean(curp) : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = recibe === "clabe" ? { ...f, payout: "clabe", clabe } : { ...f, payout: "n2bis", ...id };
      const res = await api<{ code: string }>("/api/people", { body });
      try {
        window.sessionStorage.setItem("indigentepay.alta", JSON.stringify(res));
      } catch {}
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
            Hazlo junto con ella. Al terminar imprimes su gafete: quien lo escanee le puede dar dinero al instante.
          </p>
        </div>
        <label>
          <span className="etiqueta">Nombre o apodo para su gafete</span>
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

        <fieldset className="grid gap-3">
          <legend className="mb-3 text-2xl font-extrabold tracking-tight">¿Cómo va a recibir su dinero?</legend>
          <button type="button" className="opcion" aria-pressed={recibe === "clabe"} onClick={() => setRecibe("clabe")}>
            <span className="font-bold">Ya tiene cuenta de banco</span>
            <span className="mt-1 block text-[0.9375rem] leading-snug">Cada donativo se deposita a su CLABE.</span>
          </button>
          <button type="button" className="opcion" aria-pressed={recibe === "n2bis"} onClick={() => setRecibe("n2bis")}>
            <span className="font-bold">No tiene cuenta de banco</span>
            <span className="mt-1 block text-[0.9375rem] leading-snug">
              Le abrimos una cuenta {CUENTA_NIVEL} con su nombre y su fecha de nacimiento. Paga con su gafete.
            </span>
          </button>
        </fieldset>

        {recibe === "clabe" ? (
          <label>
            <span className="etiqueta">CLABE de su cuenta (18 dígitos)</span>
            <input
              className="campo tabular-nums" inputMode="numeric" maxLength={18} value={clabe} placeholder="000000000000000000"
              onChange={(e) => setClabe(e.target.value.replace(/\D/g, ""))}
            />
            {clabe.length === 18 ? (
              <span className={`mt-2 block text-[0.9375rem] font-bold ${clabeOk ? "text-verde" : "text-rosa"}`}>
                {clabeOk ? `CLABE válida de ${bancoDeClabe(clabe)}` : "Esa CLABE no es válida. Revisa los dígitos."}
              </span>
            ) : (
              <span className="nota mt-2 block">Viene en su estado de cuenta o en la app de su banco.</span>
            )}
          </label>
        ) : null}

        {recibe === "n2bis" ? (
          <div className="grid gap-4">
            <label>
              <span className="etiqueta">Nombre(s), como en su acta</span>
              <input className="campo" value={id.names} onChange={setI("names")} placeholder="Ej. María Guadalupe" maxLength={50} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="etiqueta">Primer apellido</span>
                <input className="campo" value={id.surname1} onChange={setI("surname1")} maxLength={40} />
              </label>
              <label>
                <span className="etiqueta">Segundo apellido</span>
                <input className="campo" value={id.surname2} onChange={setI("surname2")} placeholder="Si tiene" maxLength={40} />
              </label>
            </div>
            <label>
              <span className="etiqueta">Fecha de nacimiento</span>
              <input className="campo" type="date" value={id.birth} onChange={setI("birth")} max={new Date().toISOString().slice(0, 10)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="etiqueta">Sexo en su acta</span>
                <select className="campo" value={id.sex} onChange={setI("sex")}>
                  <option value="">Elige</option>
                  <option value="M">Mujer</option>
                  <option value="H">Hombre</option>
                  <option value="X">No binario</option>
                </select>
              </label>
              <label>
                <span className="etiqueta">Estado donde nació</span>
                <select className="campo" value={id.state} onChange={setI("state")}>
                  <option value="">Elige</option>
                  {ESTADOS.map(([k, n]) => (
                    <option key={k} value={k}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="hoja bg-aviso p-4">
              <p className="text-sm font-bold">CURP calculada</p>
              <p className="mt-1 text-xl font-extrabold tracking-wider tabular-nums">{curp ?? "Completa los datos de arriba"}</p>
              <p className="mt-2 text-sm leading-snug">
                Se calcula con sus datos. Antes de abrir una cuenta real se confirma con RENAPO, que asigna el penúltimo carácter.
              </p>
            </div>
          </div>
        ) : null}

        <label>
          <span className="etiqueta">NIP de 4 dígitos</span>
          <input
            className="campo tracking-[0.5em]" value={f.pin} inputMode="numeric" pattern="\d{4}" maxLength={4} required placeholder="••••"
            onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "") })}
          />
          <span className="nota mt-2 block">Lo elige la persona y solo ella lo debe saber. Lo usa para ver su saldo y pagar con su gafete.</span>
        </label>
        <label className="flex gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-rosa" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="text-[0.9375rem] leading-snug">
            La persona está de acuerdo en que su nombre e historia aparezcan cuando alguien escanee su gafete
            {recibe === "n2bis" ? " y en que se le abra una cuenta a su nombre" : ""}.
          </span>
        </label>
        <ErrorMsg>{error}</ErrorMsg>
        <button className="btn btn-rosa" disabled={busy || !consent || !cuentaLista || f.alias.trim().length < 2 || f.pin.length !== 4}>
          {busy ? "Creando gafete…" : recibe === "n2bis" ? "Abrir cuenta y crear gafete" : "Crear gafete"}
        </button>
        {!recibe ? <p className="nota text-center">Elige cómo va a recibir su dinero para continuar.</p> : null}
      </form>
    </Pagina>
  );
}
