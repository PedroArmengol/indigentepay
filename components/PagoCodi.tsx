"use client";

import { useEffect, useState } from "react";
import { ErrorMsg, QR } from "@/components/ui";
import { api, errorText, pesos, type Summary } from "@/lib/client";

type Pay = { id: string; amount: number; status: "PENDING" | "PAID"; method?: "qr" | "pn"; qrImage?: string; qrString?: string };
export type PagoHecho = { amount: number; deposited?: boolean; summary?: Summary | null };

/** Pago directo con CoDi a un gafete: el cobro va referenciado a esa persona. */
export function PagoCodi({ code, cents, onPaid }: { code: string; cents: number; onPaid: (r: PagoHecho) => void }) {
  const [pay, setPay] = useState<Pay | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Se consulta hasta que el banco confirma el pago
  useEffect(() => {
    if (!pay) return;
    const timer = setInterval(async () => {
      try {
        const res = await api<{ pay: Pay & PagoHecho }>(`/api/pay/${pay.id}`);
        if (res.pay.status === "PAID") {
          clearInterval(timer);
          onPaid({ amount: res.pay.amount, deposited: res.pay.deposited, summary: res.pay.summary });
        }
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pay]);

  async function crear(method: "qr" | "pn") {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ pay: Pay }>("/api/pay", { body: { code, amount: cents / 100, method, phone } });
      setPay(res.pay);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (pay) {
    return (
      <div className="grid gap-4">
        {pay.method === "pn" ? (
          <div className="hoja bg-aviso p-4">
            <p className="font-bold">Te mandamos el cobro de {pesos(pay.amount)} a tu celular</p>
            <p className="mt-1 text-[0.9375rem] leading-snug">Abre la app de tu banco y acepta la solicitud de cobro CoDi. Tienes 6 minutos.</p>
          </div>
        ) : (
          <>
            <p className="leading-snug">
              En la app de tu banco entra a CoDi, elige pagar con QR y escanea este código para pagar {pesos(pay.amount)}.
            </p>
            <div className="rotulo mx-auto p-3">
              {pay.qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:image/png;base64,${pay.qrImage}`} alt="QR CoDi para pagar" width={240} height={240} />
              ) : pay.qrString ? (
                <QR value={pay.qrString} size={240} />
              ) : null}
            </div>
          </>
        )}
        <p className="nota text-center">Esperando el pago de tu banco… Va referenciado al gafete {code}.</p>
        <button className="font-bold underline underline-offset-4" onClick={() => setPay(null)}>
          Cambiar el monto o la forma de pago
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ErrorMsg>{error}</ErrorMsg>
      <button className="btn btn-rosa" onClick={() => crear("qr")} disabled={busy || cents <= 0}>
        {busy ? "Preparando…" : `Pagar ${cents > 0 ? pesos(cents) : ""} con QR CoDi`}
      </button>
      <div className="hoja grid gap-3 p-4">
        <label>
          <span className="etiqueta">¿Estás en el celular? Recibe el cobro en la app de tu banco</span>
          <input
            className="campo tabular-nums" inputMode="numeric" maxLength={10} value={phone} placeholder="Tu celular a 10 dígitos"
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <button className="btn" onClick={() => crear("pn")} disabled={busy || cents <= 0 || phone.length !== 10}>
          Mandar cobro a mi celular
        </button>
      </div>
    </div>
  );
}
