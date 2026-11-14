"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

/** Lee un QR con la cámara trasera. Llama a onCode una sola vez con el texto leído. */
export function Scanner({ onCode }: { onCode: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let done = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      const v = video.current;
      if (done || !v || !ctx) return;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (found?.data) {
          done = true;
          cb.current(found.data);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no da acceso a la cámara. Escribe el código del gafete.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        if (done) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => {});
        }
        frame = requestAnimationFrame(tick);
      })
      .catch(() => setError("No pudimos abrir la cámara. Da permiso en tu navegador o escribe el código del gafete."));

    return () => {
      done = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) return <p className="aviso-error">{error}</p>;
  return (
    <div className="relative overflow-hidden rounded-[20px] border-2 border-tinta bg-tinta">
      <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
      <div className="pointer-events-none absolute inset-10 rounded-2xl border-[3px] border-aviso" />
    </div>
  );
}
