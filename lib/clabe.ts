/** Validación de CLABE (18 dígitos con dígito de control) y nombre del banco. */

const BANCOS: Record<string, string> = {
  "002": "Banamex", "012": "BBVA", "014": "Santander", "021": "HSBC", "030": "BanBajío", "036": "Inbursa",
  "044": "Scotiabank", "058": "Banregio", "072": "Banorte", "127": "Banco Azteca", "137": "BanCoppel",
  "638": "Nu", "646": "STP", "722": "Mercado Pago", "728": "Spin by OXXO",
};
const PESOS = [3, 7, 1];

export function digitoClabe(clabe17: string): string {
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += (Number(clabe17[i]) * PESOS[i % 3]) % 10;
  return String((10 - (suma % 10)) % 10);
}

export function clabeValida(clabe: string): boolean {
  return /^\d{18}$/.test(clabe) && digitoClabe(clabe.slice(0, 17)) === clabe[17];
}

export const bancoDeClabe = (clabe: string) => BANCOS[clabe.slice(0, 3)] ?? "su banco";
export const ultimos4 = (clabe: string) => clabe.slice(-4);
