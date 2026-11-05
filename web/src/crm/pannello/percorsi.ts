import type { Location } from "react-router";

const SCHEDA = /^\/(aziende|persone|trattative)\/(?!create$)[^/]+$/;
const MODIFICA = /^\/persone\/(?!create$)[^/]+\/modifica$/;
const CRONOLOGIA = /^\/cronologia\/(aziende|persone|trattative)\/[^/]+$/;
const NUOVA = /^\/(aziende|persone)\/create$/;

export const siApreNelPannello = (p: string) => SCHEDA.test(p) || MODIFICA.test(p) || CRONOLOGIA.test(p);

export const restaNelPannello = (p: string) => siApreNelPannello(p) || NUOVA.test(p);

export const senzaPannello = (p: string) => p === "/chiama" || p.startsWith("/chiama/") || NUOVA.test(p) || MODIFICA.test(p);

export interface StatoPannello {
  sfondo: Location;
  passo: number;
  sfondoCambiato?: boolean;
}

export const statoDi = (l: { pathname: string; state?: unknown }): StatoPannello | null => {
  const s = l.state as Partial<StatoPannello> | null | undefined;
  if (typeof s?.sfondo?.pathname !== "string" || !restaNelPannello(l.pathname)) return null;
  return { sfondo: s.sfondo, passo: Number(s.passo) || 1, sfondoCambiato: s.sfondoCambiato };
};
