"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Scanner } from "@/components/Scanner";
import { ErrorMsg, Pagina } from "@/components/ui";
import { leerCodigo } from "@/lib/client";

export default function Escanear() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function ir(texto: string) {
    const c = leerCodigo(texto);
    if (c.length < 4) return setError("Ese QR no es un gafete de IndigentePay.");
    router.push(`/p/${c}`);
  }

  return (
    <Pagina>
      <div className="grid gap-5 pt-2">
        <h1 className="text-4xl">Escanea el gafete</h1>
        <Scanner onCode={ir} />
        <ErrorMsg>{error}</ErrorMsg>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ir(code);
          }}
        >
          <label>
            <span className="etiqueta">O escribe el código impreso en el gafete</span>
            <input className="campo uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej. LUPITA" autoCapitalize="characters" />
          </label>
          <button className="btn" disabled={code.trim().length < 4}>
            Buscar gafete
          </button>
        </form>
      </div>
    </Pagina>
  );
}
