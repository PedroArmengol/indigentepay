import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: "IndigentePay · ayuda en la calle sin efectivo",
  description:
    "Escanea el gafete de una persona en situación de calle, dale desde tu wallet y lleva la cuenta de cuánto das al mes.",
};

export const viewport: Viewport = { themeColor: "#f3f2f9", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
