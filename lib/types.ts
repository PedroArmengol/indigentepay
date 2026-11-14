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
  redeemed: number;
  createdAt: number;
};

export type RecipientRecord = Recipient & { pinHash: string };

export type TxType = "fund" | "donation" | "redeem";

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
  donorId: string;
  amount: number;
  status: "PENDING" | "PAID";
  provider: "sim" | "pey";
  providerRef?: string; // id del QR CoDi en Pey
  qrImage?: string; // PNG en base64 (solo Pey)
  createdAt: number;
};

export type Stats = {
  donated: number;
  donations: number;
  redeemed: number;
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

  /** Regresa false si el código ya existe. */
  createRecipient(r: RecipientRecord): Promise<boolean>;
  getRecipient(code: string): Promise<RecipientRecord | null>;
  recipientTxs(code: string, limit?: number): Promise<Tx[]>;

  /** Mueve saldo de la wallet al gafete de forma atómica. */
  donate(donorId: string, code: string, amount: number, tx: Tx): Promise<MoveResult>;
  /** Descuenta saldo del gafete (compra en comercio aliado) de forma atómica. */
  redeem(code: string, amount: number, tx: Tx): Promise<MoveResult>;

  /** Cuenta un NIP incorrecto; regresa los intentos en la ventana de bloqueo. */
  pinFail(code: string): Promise<number>;
  pinFails(code: string): Promise<number>;
  pinReset(code: string): Promise<void>;

  stats(): Promise<Stats>;
}
