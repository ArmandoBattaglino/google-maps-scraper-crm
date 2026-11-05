import { dataEOra } from "@/crm/tempo";
import { euro } from "@/crm/trattative/tipi";
import type { Contesto } from "./contesto";

const GIORNO = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const NUMERO = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2, useGrouping: true });
const IN_EURO = new Set(["valore", "avvio", "canone"]);
export const TESTO_INTERO = new Set(["ultima_nota", "note"]);

export const valoreDi = (riga: Record<string, unknown>, campo: string): unknown => {
  if (campo.startsWith("campi.")) return (riga.campi as Record<string, unknown> | null | undefined)?.[campo.slice(6)];
  return riga[campo];
};

const eVuoto = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);

export const testoSegni = (segni: unknown): string => {
  const s = (segni ?? {}) as { archiviata?: boolean; altre_aperte?: number };
  return `${s.altre_aperte ? ` +${s.altre_aperte}` : ""}${s.archiviata ? " · archiviata" : ""}`;
};

export const testoValore = (ctx: Contesto, campo: string, v: unknown): string => {
  if (eVuoto(v)) return "";
  const voce = ctx.voce(campo);
  if (Array.isArray(v)) return v.map((x) => ctx.etichettaDi(campo, x)).join(", ");
  switch (voce?.tipo) {
    case "istante":
      return dataEOra(String(v));
    case "data":
      return GIORNO.format(new Date(`${String(v).slice(0, 10)}T00:00:00Z`));
    case "numero":
      if (IN_EURO.has(campo) || voce.tipo_campo === "valuta") return euro(v as number);
      return NUMERO.format(Number(v));
    case "booleano":
      return v ? "Sì" : "No";
    default:
      return ctx.etichettaDi(campo, v);
  }
};

export const testoTotale = (ctx: Contesto, chiave: string, v: number | string | null): { nome: string; valore: string } => {
  const [fn, campo] = chiave.split(":");
  return { nome: `${fn} ${ctx.nome(campo).toLowerCase()}`, valore: v === null ? "—" : testoValore(ctx, campo, v) };
};
