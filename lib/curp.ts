/**
 * Cálculo de la CURP a partir de los datos de la persona.
 *
 * Se pueden derivar 16 de los 18 caracteres con nombre, apellidos, fecha de
 * nacimiento, sexo y entidad de nacimiento. La posición 17 la asigna RENAPO
 * para evitar duplicados: aquí se usa el valor más común (0 antes de 2000,
 * A desde 2000), así que la clave resultante es una CURP calculada que debe
 * validarse con RENAPO antes de abrir una cuenta real. La posición 18 es el
 * dígito verificador y sí se calcula.
 */

export const ESTADOS: [string, string][] = [
  ["AS", "Aguascalientes"], ["BC", "Baja California"], ["BS", "Baja California Sur"], ["CC", "Campeche"],
  ["CS", "Chiapas"], ["CH", "Chihuahua"], ["DF", "Ciudad de México"], ["CL", "Coahuila"], ["CM", "Colima"],
  ["DG", "Durango"], ["MC", "Estado de México"], ["GT", "Guanajuato"], ["GR", "Guerrero"], ["HG", "Hidalgo"],
  ["JC", "Jalisco"], ["MN", "Michoacán"], ["MS", "Morelos"], ["NT", "Nayarit"], ["NL", "Nuevo León"],
  ["OC", "Oaxaca"], ["PL", "Puebla"], ["QT", "Querétaro"], ["QR", "Quintana Roo"], ["SP", "San Luis Potosí"],
  ["SL", "Sinaloa"], ["SR", "Sonora"], ["TC", "Tabasco"], ["TS", "Tamaulipas"], ["TL", "Tlaxcala"],
  ["VZ", "Veracruz"], ["YN", "Yucatán"], ["ZS", "Zacatecas"], ["NE", "Nació en el extranjero"],
];

const PARTICULAS = new Set(["DA", "DAS", "DE", "DEL", "DER", "DI", "DIE", "DD", "EL", "LA", "LOS", "LAS", "LE", "LES", "MAC", "MC", "VAN", "VON", "Y"]);
const NOMBRES_COMUNES = new Set(["MARIA", "MA", "MA.", "JOSE", "J", "J."]);
const ALTISONANTES = new Set(
  ("BACA BAKA BUEI BUEY CACA CACO CAGA CAGO CAKA CAKO COGE COGI COJA COJE COJI COJO COLA CULO FALO FETO GETA GUEI GUEY " +
    "JETA JOTO KACA KACO KAGA KAGO KAKA KAKO KOGE KOGI KOJA KOJE KOJI KOJO KOLA KULO LILO LOCA LOCO LOKA LOKO MAME MAMO " +
    "MEAR MEAS MEON MIAR MION MOCO MOKO MULA MULO NACA NACO PEDA PEDO PENE PIPI PITO POPO PUTA PUTO QULO RATA ROBA ROBE " +
    "ROBO RUIN SENO TETA VACA VAGA VAGO VAKA VUEI VUEY WUEI WUEY").split(" "),
);
const VALORES = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

/** Mayúsculas sin acentos (conserva la Ñ) y sin partículas como DE, DEL, LA. */
function palabras(texto: string): string[] {
  const limpio = texto
    .toUpperCase()
    .replace(/Ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "Ñ")
    .replace(/[^A-ZÑ.\s/-]/g, " ");
  const partes = limpio.split(/\s+/).filter(Boolean);
  const utiles = partes.filter((p) => !PARTICULAS.has(p));
  return utiles.length ? utiles : partes;
}

const letra = (c: string | undefined) => (!c || !/[A-Z]/.test(c) ? "X" : c); // Ñ, guiones y vacíos → X
const vocalInterna = (p: string) => letra(p.slice(1).match(/[AEIOU]/)?.[0]);
const consonanteInterna = (p: string) => letra(p.slice(1).match(/[BCDFGHJKLMNÑPQRSTVWXYZ]/)?.[0]);

export function digitoVerificador(curp17: string): string {
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += Math.max(0, VALORES.indexOf(curp17[i])) * (18 - i);
  return String((10 - (suma % 10)) % 10);
}

export type DatosCurp = {
  names: string;
  surname1: string;
  surname2?: string;
  birth: string; // AAAA-MM-DD
  sex: "H" | "M" | "X";
  state: string; // clave de dos letras
};

/** Regresa la CURP calculada (18 caracteres) o null si faltan datos. */
export function calcularCurp(d: DatosCurp): string | null {
  const fecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.birth ?? "");
  const ap1 = palabras(d.surname1 ?? "")[0];
  const ap2 = palabras(d.surname2 ?? "")[0];
  const nombres = palabras(d.names ?? "");
  if (!fecha || !ap1 || !nombres.length) return null;
  if (!["H", "M", "X"].includes(d.sex) || !ESTADOS.some(([k]) => k === d.state)) return null;

  // "María" y "José" se saltan cuando hay un segundo nombre
  const nombre = nombres.length > 1 && NOMBRES_COMUNES.has(nombres[0]) ? nombres[1] : nombres[0];

  let raiz = letra(ap1[0]) + vocalInterna(ap1) + letra(ap2?.[0]) + letra(nombre[0]);
  if (ALTISONANTES.has(raiz)) raiz = raiz[0] + "X" + raiz.slice(2);

  const [, anio, mes, dia] = fecha;
  const cuerpo =
    raiz + anio.slice(2) + mes + dia + d.sex + d.state +
    consonanteInterna(ap1) + (ap2 ? consonanteInterna(ap2) : "X") + consonanteInterna(nombre);
  const diferenciador = Number(anio) < 2000 ? "0" : "A"; // lo asigna RENAPO; este es el valor más común
  const curp17 = cuerpo + diferenciador;
  return curp17 + digitoVerificador(curp17);
}

export function fechaValida(birth: string, hoy = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth ?? "");
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return false;
  return d.getTime() < hoy.getTime() && Number(m[1]) >= 1900;
}

/** Edad cumplida en años. */
export function edad(birth: string, hoy = new Date()): number {
  const [y, mo, da] = birth.split("-").map(Number);
  let e = hoy.getUTCFullYear() - y;
  if (hoy.getUTCMonth() + 1 < mo || (hoy.getUTCMonth() + 1 === mo && hoy.getUTCDate() < da)) e -= 1;
  return e;
}
