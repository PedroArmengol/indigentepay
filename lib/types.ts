// Todos los montos se guardan en centavos (enteros).

export type Donor = {
  id: string; // también es la llave de acceso de la wallet
  name: string;
  balance: number;
  budget: number; // presupuesto mensual de beneficencia
  createdAt: number;
};

export type Recipient = {
  code: string; // lo que va en el QR
  alias: string;
  zone: string;
  need: string;
  story: string;
  balance: number;
  received: number;
  donations: number;
  redeemed: number; // gastado en comercios aliados
  paidOut: number; // depositado a su cuenta de banco
  createdAt: number;
  /** Cómo recibe su dinero: en su propia cuenta (CLABE) o en la cuenta básica que se le abre. */
  payout?: "clabe" | "n2bis";
  /** Contenido del QR CoDi fijo de la persona (sin monto ni vencimiento): es el que va impreso en su gafete. */
  codiQr?: string;
};

/** Datos privados: nunca salen en el perfil público. */
export type RecipientRecord = Recipient & {
  pinHash: string;
  clabe?: string;
  bank?: string;
  legalName?: string;
  curp?: string;
  account?: string; // número de la cuenta básica (simulada)
  codiQrId?: string; // id del QR fijo en Pey
};

export type TxType = "fund" | "donation" | "redeem" | "payout";

export type Tx = {
  id: string;
  ts: number;
  type: TxType;
  amount: number;
  donorName?: string;
  code?: string;
  alias?: string;
  merchant?: string;
  concept?: string;
};

export type Fund = {
  id: string;
  donorId: string; // wallet que paga; vacío si es un pago directo sin wallet
  target?: string; // pago directo: código del gafete que recibe
  donorName?: string;
  amount: number;
  status: "PENDING" | "PAID";
  provider: "sim" | "pey";
  method?: "qr" | "pn"; // QR CoDi o cobro a la app del banco (solo Pey)
  providerRef?: string; // id del QR CoDi o id de la transacción del cobro en Pey
  qrImage?: string; // PNG en base64 (solo Pey)
  qrString?: string; // contenido del QR, por si Pey no regresa la imagen
  createdAt: number;
};

export type Stats = {
  donated: number;
  donations: number;
  redeemed: number;
  paidOut: number;
  fundedReal: number; // pesos reales recibidos por CoDi en la cuenta concentradora
  people: number;
  donors: number;
};

export type MoveResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "funds" | "donor" | "recipient" };

export interface Store {
  createDonor(d: Donor): Promise<void>;
  getDonor(id: string): Promise<Donor | null>;
  setBudget(id: string, budget: number): Promise<void>;
  donorTxs(id: string, limit?: number): Promise<Tx[]>;

  createFund(f: Fund): Promise<void>;
  getFund(id: string): Promise<Fund | null>;
  findFundByRef(ref: string): Promise<Fund | null>;
  /** PENDING → PAID y abona a la wallet, una sola vez. */
  confirmFund(id: string, tx: Tx): Promise<"ok" | "already" | "missing">;
  /** Pago directo: PENDING → PAID y abona al gafete del receptor referenciado, una sola vez. */
  confirmDirect(id: string, tx: Tx): Promise<"ok" | "already" | "missing">;

  /** Regresa false si el código ya existe. */
  createRecipient(r: RecipientRecord): Promise<boolean>;
  getRecipient(code: string): Promise<RecipientRecord | null>;
  recipientTxs(code: string, limit?: number): Promise<Tx[]>;

  /** Mueve saldo de la wallet al gafete de forma atómica. */
  donate(donorId: string, code: string, amount: number, tx: Tx): Promise<MoveResult>;
  /** Descuenta saldo del gafete de forma atómica: compra en comercio aliado o depósito a su banco. */
  redeem(code: string, amount: number, tx: Tx, kind?: "redeem" | "payout"): Promise<MoveResult>;

  /** Guarda el QR CoDi fijo de una persona y lo indexa por su id en Pey. */
  setRecipientQr(code: string, qrId: string, qrString: string): Promise<void>;
  /** Mapa id de QR fijo → código de gafete. */
  qrMap(): Promise<Record<string, string>>;
  /** Ids de transacciones de Pey ya abonadas. */
  paidTxIds(): Promise<Set<string>>;
  /** Abona a un gafete un pago recibido en su QR fijo. `payId` evita abonar dos veces la misma transacción. */
  creditRecipient(code: string, amount: number, tx: Tx, payId: string): Promise<"ok" | "already" | "missing">;
  /** Candado breve para no consultar a Pey en cada petición. Regresa true si se obtuvo. */
  lock(name: string, seconds: number): Promise<boolean>;

  /** Cuenta un NIP incorrecto; regresa los intentos en la ventana de bloqueo. */
  pinFail(code: string): Promise<number>;
  pinFails(code: string): Promise<number>;
  pinReset(code: string): Promise<void>;

  stats(): Promise<Stats>;
}
