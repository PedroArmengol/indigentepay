"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Gafete, Pagina, useOrigin, type Persona } from "@/components/ui";
import { api } from "@/lib/client";

export default function VerGafete() {
  const { code } = useParams<{ code: string }>();
  const origin = useOrigin();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [nuevo, setNuevo] = useState(false);

  useEffect(() => {
    setNuevo(new URLSearchParams(window.location.search).has("nuevo"));
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
