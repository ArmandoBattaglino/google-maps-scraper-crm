import type { EventInput } from "@fullcalendar/core";
import type { RigaVista } from "../dati";
import { valoreDi } from "../formato";
import type { Risorsa } from "../stato";
import { calcolatoQui } from "../Tabella/editor";
import { conGiorno, giornoRoma, istanteRoma, oraRoma } from "../tempo";

const TITOLI: Record<Risorsa, string[]> = {
  aziende: ["nome"],
  persone: ["nome"],
  trattative: ["azienda.nome", "persona.nome", "prossimo_passo"],
  attivita: ["testo", "tipo", "azienda_id"],
};
export const colonneTitolo = (r: Risorsa) => TITOLI[r];

export const titoloDi = (r: Risorsa, riga: RigaVista): string => {
  for (const c of TITOLI[r]) {
    const v = riga[c];
    if (typeof v === "string" && v.trim() && c !== "azienda_id") return v;
  }
  return "Senza titolo";
};

export const eventoDi = (r: Risorsa, riga: RigaVista, campo: string, tipo: string, trascinabile: boolean): EventInput | null => {
  const v = valoreDi(riga, campo);
  if (typeof v !== "string" || !v) return null;
  const base = { id: riga.id, title: titoloDi(r, riga), startEditable: trascinabile && !calcolatoQui(r, riga, campo), extendedProps: { riga } };
  if (tipo === "data") return { ...base, start: v.slice(0, 10), allDay: true };
  return { ...base, start: `${giornoRoma(v)}T${oraRoma(v)}`, allDay: false };
};

export const nuovoValore = (tipo: string, vecchio: unknown, inizio: Date, soloGiorni: boolean): string => {
  const [giorno, resto] = inizio.toISOString().split("T");
  if (tipo === "data") return giorno;
  if (soloGiorni) return conGiorno(vecchio as string, giorno);
  return istanteRoma(giorno, resto.slice(0, 5));
};
