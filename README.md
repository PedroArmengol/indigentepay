# IndigentePay

**«No traigo cambio» ya no es pretexto.** Ayuda en la calle sin efectivo: escaneas el gafete de una persona en situación de calle, le das desde tu wallet y llevas la cuenta de cuánto das al mes.

Proyecto del Cursor Hackathon México (CDMX, 14 de noviembre de 2026).

- **App en vivo:** https://indigentepay.vercel.app (demo guiada: https://indigentepay.vercel.app/demo)
- **Video demo:** _pega aquí la liga_

## El problema

Cada vez cargamos menos efectivo, y quien vive de la moneda que le dan en la calle se queda fuera. Además, quien quiere ayudar no sabe cuánto da ni a dónde va su dinero.

## Cómo funciona

| Quién | Qué hace | Pantalla |
|---|---|---|
| **Donante** | Abre una wallet, la fondea y fija su presupuesto mensual de beneficencia. Escanea un gafete y da. Ve cuánto lleva del mes, a cuántas personas ayudó y su historial. | `/wallet`, `/escanear`, `/p/{código}` |
| **Persona en situación de calle** | Recibe un gafete impreso con su QR único y elige un NIP. Al registrarla se elige cómo recibe su dinero (ver abajo). | `/registrar`, `/gafete/{código}`, `/saldo/{código}` |
| **Comercio aliado** | Escanea el gafete, la persona teclea su NIP y se cobra comida o medicinas de su saldo. | `/canjear` |

### Dos formas de recibir

- **Ya tiene cuenta de banco.** Se captura su CLABE (se valida el dígito de control) y cada donativo se le deposita al momento. En la demo el depósito es simulado.
- **No tiene cuenta de banco.** Se le abre una cuenta Nivel 2 Bis con nombre, apellidos, fecha de nacimiento, sexo y estado de nacimiento; con esos datos se calcula su CURP. El saldo vive en esa cuenta y lo gasta con su gafete y su NIP en comercios aliados. En la demo la cuenta es simulada.

`/demo` tiene cuatro gafetes de prueba (NIP `1234`) para recorrer el ciclo completo en dos minutos.

## Correrlo

```bash
npm install
npm run dev          # http://localhost:3000 (datos en memoria)
npm test             # pruebas del almacén (memoria y Redis real; requiere redis-server)
node tests/e2e.mjs http://localhost:3000   # flujo completo por la API
```

## Desplegar en Vercel

1. Importa el repositorio en [vercel.com/new](https://vercel.com/new) y despliega.
2. En el proyecto: **Storage → Upstash → Redis**, crea la base y conéctala. Eso agrega `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. Agrega `PIN_SALT` con un valor largo y vuelve a desplegar.
4. Abre `/demo`: al final debe decir «Datos guardados en Redis».

Sin Redis la app funciona, pero los saldos viven en la memoria de cada instancia y se pierden.

## Arquitectura

- **Next.js 16 (App Router) + TypeScript + Tailwind 4.** Una sola app: páginas y API.
- **Redis (Upstash, por REST).** Cada movimiento de dinero corre en un script Lua, así que es atómico: diez donativos simultáneos no pueden gastar el mismo saldo dos veces. Hay una prueba para eso.
- **Montos en centavos enteros.** Nada de decimales flotantes.
- **Wallet sin registro.** La llave de la wallet se genera en el servidor y vive en el `localStorage` del celular.
- **Gafete con NIP.** El NIP se guarda con hash y sal; cinco intentos fallidos bloquean el gafete diez minutos. El perfil público nunca muestra el saldo.
- **CURP calculada.** `lib/curp.ts` deriva 16 de los 18 caracteres y el dígito verificador. El carácter 17 lo asigna RENAPO para evitar duplicados; se usa el valor más común y la clave se marca como «calculada», por confirmar.
- **Pago directo al receptor.** Con CoDi activado, quien escanea un gafete puede pagar directo desde su banco, sin wallet. El cobro lleva el código del gafete en sus metadatos y en el concepto, así que al confirmarse se abona a la subcuenta de esa persona. Si quien paga tiene wallet, el donativo también cuenta para su presupuesto del mes.
- **Fondeo y cuenta concentradora.** Simulado por omisión. Con `PEY_API_KEY` el fondeo es un cobro CoDi real vía [Pey](https://docs.pey.mx): QR para escanear desde la app del banco, o solicitud de cobro al celular. El dinero llega a una sola cuenta bancaria (la concentradora) e IndigentePay lleva el libro de subcuentas: cada wallet y cada gafete es una subcuenta. El pago se confirma consultando la transacción en Pey (y también por webhook firmado, si se configura); un aviso repetido no abona dos veces.

```
app/            páginas y rutas de la API
components/     gafete, QR, escáner, barra de presupuesto
lib/core.ts     reglas: límites, presupuesto del mes, códigos, NIP
lib/store-*.ts  almacén en memoria y en Redis (misma interfaz, mismas pruebas)
lib/curp.ts     cálculo de la CURP
lib/cuenta.ts   etiqueta del nivel de cuenta
lib/clabe.ts    validación de CLABE
lib/pey.ts      cobro CoDi con Pey
tests/          pruebas del almacén y flujo de punta a punta
```

## Qué es demo y qué falta

- Sin `PEY_API_KEY` el fondeo es **simulado**. Con la llave, el fondeo mueve dinero real por CoDi; la salida de dinero (depósitos a CLABE y pagos a comercios) sigue siendo simulada.
- La cuenta Nivel 2 Bis y los depósitos a CLABE son **simulados**. Abrir cuentas reales requiere a un banco, confirmar la CURP con RENAPO y cumplir los requisitos de identificación que la regulación pide para ese nivel de cuenta.
- Las personas de los gafetes de demostración son ficticias.
- Para operar con dinero real hace falta: figura regulada para custodiar fondos (institución de fondos de pago electrónico o alianza con una), identificación de donantes y prevención de lavado, liquidación a comercios aliados, y recuperación de gafetes perdidos.
- El registro debe hacerse con el consentimiento de la persona, idealmente a través de albergues y organizaciones que ya trabajan con ella.

## Licencia

MIT
