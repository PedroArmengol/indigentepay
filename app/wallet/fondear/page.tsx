"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorMsg, Montos, Pagina, QR, Sello } from "@/components/ui";
import { api, errorText, pesos, useWallet } from "@/lib/client";

type Fund = {
  id: string; amount: number; status: "PENDING" | "PAID"; provider: "sim" | "pey";
  method?: "qr" | "pn"; qrImage?: string; qrString?: string;
};

export default function Fondear() {
  const router = useRouter();
  const { status, data, reload } = useWallet();
  const [amount, setAmount] = useState("200");
  const [phone, setPhone] = useState("");
  const [codi, setCodi] = useState(false);
  const [fund, setFund] = useState<Fund | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [volver, setVolver] = useState("/wallet");

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("volver");
    if (v && v.startsWith("/") && !v.startsWith("//")) setVolver(v);
    api<{ funding: string }>("/api/stats").then((r) => setCodi(r.funding === "codi")).catch(() => {});
  }, []);
  useEffect(() => {
    if (status === "sin-wallet") router.replace("/wallet");
  }, [status, router]);

  // Cobro CoDi real: se consulta hasta que el banco confirma el pago
  useEffect(() => {
    if (!fund || fund.provider !== "pey" || paid) return;
    const timer = setInterval(async () => {
      try {
        const res = await api<{ fund: Fund }>(`/api/fund/${fund.id}`);
        if (res.fund.status === "PAID") {
          setPaid(true);
          void reload();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, [fund, paid, reload]);

  async function crear(method: "qr" | "pn") {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ fund: Fund }>("/api/fund", { body: { amount, method, phone } });
      setFund(res.fund);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function simular() {
    if (!fund) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/fund/${fund.id}`, { method: "POST", body: {} });
      setPaid(true);
      await reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const monto = Number(amount) ? pesos(Math.round(Number(amount) * 100)) : "";

  return (
    <Pagina>
      {paid && fund ? (
        <div className="grid gap-5 pt-6 text-center">
          <Sello>Saldo<br />abonado</Sello>
          <h1 className="text-4xl">Fondeaste {pesos(fund.amount)}</h1>
          <p>Tu saldo ahora es de {pesos(data?.donor.balance ?? fund.amount)}.</p>
          <Link href={volver} className="btn btn-rosa">
            {volver === "/wallet" ? "Volver a mi wallet" : "Continuar con mi donativo"}
          </Link>
        </div>
      ) : fund ? (
        <div className="grid gap-5 pt-4">
          <h1 className="text-4xl">Paga {pesos(fund.amount)}</h1>
          {fund.provider === "pey" && fund.method === "pn" ? (
            <>
              <div className="hoja bg-aviso p-4">
                <p className="font-bold">Te mandamos el cobro a tu celular</p>
                <p className="mt-1 text-[0.9375rem] leading-snug">
                  Abre la app de tu banco y acepta la solicitud de cobro CoDi. Tienes 6 minutos.
                </p>
              </div>
              <p className="nota text-center">Esperando el pago de tu banco…</p>
            </>
          ) : fund.provider === "pey" ? (
            <>
              <p className="leading-snug">
                En la app de tu banco entra a CoDi, elige pagar con QR y escanea este código. Tu saldo se abona solo en
                cuanto llegue el pago.
              </p>
              <div className="rotulo mx-auto p-3">
                {fund.qrImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`data:image/png;base64,${fund.qrImage}`} alt="QR CoDi para fondear" width={240} height={240} />
                ) : fund.qrString ? (
                  <QR value={fund.qrString} size={240} />
                ) : null}
              </div>
              <p className="nota text-center">Esperando el pago de tu banco… El código vence en 6 minutos.</p>
            </>
          ) : (
            <>
              <div className="hoja bg-aviso p-4">
                <p className="font-bold">Pago simulado</p>
                <p className="mt-1 text-[0.9375rem] leading-snug">
                  En esta demo no se cobra dinero real. Con el cobro CoDi activado, aquí aparece el QR para pagar desde
                  la app de tu banco.
                </p>
              </div>
              <button className="btn btn-rosa" onClick={simular} disabled={busy}>
                {busy ? "Abonando…" : `Simular pago de ${pesos(fund.amount)}`}
              </button>
            </>
          )}
          <ErrorMsg>{error}</ErrorMsg>
          <button className="font-bold underline underline-offset-4" onClick={() => setFund(null)}>
            Cambiar el monto o la forma de pago
          </button>
        </div>
      ) : (
        <div className="grid gap-5 pt-4">
          <div>
            <h1 className="text-4xl">Fondea tu wallet</h1>
            {data ? <p className="mt-3">Saldo actual: {pesos(data.donor.balance)}</p> : null}
          </div>
          <Montos value={amount} onChange={setAmount} opciones={[100, 200, 500, 1000]} />
          <ErrorMsg>{error}</ErrorMsg>
          {codi ? (
            <>
              <button className="btn btn-rosa" onClick={() => crear("qr")} disabled={busy || !Number(amount)}>
                {busy ? "Preparando…" : `Pagar ${monto} con QR CoDi`}
              </button>
              <div className="hoja grid gap-3 p-4">
                <label>
                  <span className="etiqueta">¿Estás en el celular? Recibe el cobro en la app de tu banco</span>
                  <input
                    className="campo tabular-nums" inputMode="numeric" maxLength={10} value={phone} placeholder="Tu celular a 10 dígitos"
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <button className="btn" onClick={() => crear("pn")} disabled={busy || !Number(amount) || phone.length !== 10}>
                  Mandar cobro a mi celular
                </button>
              </div>
              <p className="nota">Pago real con CoDi. El dinero llega a la cuenta concentradora de IndigentePay y se abona a tu wallet.</p>
            </>
          ) : (
            <button className="btn btn-rosa" onClick={() => crear("qr")} disabled={busy || !Number(amount)}>
              {busy ? "Preparando…" : `Fondear ${monto}`}
            </button>
          )}
        </div>
      )}
    </Pagina>
  );
}
