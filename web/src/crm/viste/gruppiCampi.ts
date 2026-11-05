import type { LucideIcon } from "lucide-react";
import { ClipboardList, Link2, Milestone, SlidersHorizontal } from "lucide-react";
import { ENTITA, ICONA_ENTITA, NOME_ENTITA, type Entita } from "@/crm/entita";
import type { GruppoOpzioni } from "@/crm/Scelta";
import type { Risorsa } from "./stato";

export interface GruppoCampi {
  chiave: string;
  nome: string;
  breve: string;
  icona: LucideIcon;
  parole: string;
}

const AL_SINGOLARE: Record<Entita, string> = { trattative: "Trattativa", aziende: "Azienda", persone: "Persona", attivita: "Attività" };

const diEntita = (e: Entita): GruppoCampi => ({
  chiave: e,
  nome: NOME_ENTITA[e],
  breve: AL_SINGOLARE[e],
  icona: ICONA_ENTITA[e],
  parole: `${NOME_ENTITA[e]} ${AL_SINGOLARE[e]}`,
});

const LEGAMI: Record<string, Entita> = { trattativa: "trattative", azienda: "aziende", persona: "persone" };

const RESTO: GruppoCampi[] = [
  { chiave: "fase", nome: "Fase", breve: "Fase", icona: Milestone, parole: "Fase" },
  { chiave: "scheda", nome: "Scheda", breve: "Scheda", icona: ClipboardList, parole: "Scheda" },
  { chiave: "campi", nome: "Campi personalizzati", breve: "Personalizzato", icona: SlidersHorizontal, parole: "Campi" },
];

export const gruppoDi = (campo: string, risorsa: Risorsa): GruppoCampi => {
  const punto = campo.indexOf(".");
  if (punto < 0) return diEntita(risorsa);
  const legame = campo.slice(0, punto);
  if (LEGAMI[legame]) return diEntita(LEGAMI[legame]);
  const nome = legame.replace(/^./, (c) => c.toUpperCase());
  return RESTO.find((g) => g.chiave === legame) ?? { chiave: legame, nome, breve: nome, icona: Link2, parole: nome };
};

const DELLA_RIGA = new Set(["fase", "scheda", "campi"]);

export const gruppoColonna = (campo: string, risorsa: Risorsa): GruppoCampi =>
  DELLA_RIGA.has(campo.split(".")[0]) ? diEntita(risorsa) : gruppoDi(campo, risorsa);

export const inGruppi = <T,>(voci: readonly T[], campoDi: (voce: T) => string, risorsa: Risorsa) => {
  const ordine = [risorsa as string, ...ENTITA.filter((e) => e !== risorsa), ...RESTO.map((g) => g.chiave)];
  const posto = (chiave: string) => (ordine.includes(chiave) ? ordine.indexOf(chiave) : ordine.length);
  const gruppi = new Map<string, { gruppo: GruppoCampi; voci: T[] }>();
  for (const voce of voci) {
    const gruppo = gruppoDi(campoDi(voce), risorsa);
    const g = gruppi.get(gruppo.chiave);
    if (g) g.voci.push(voce);
    else gruppi.set(gruppo.chiave, { gruppo, voci: [voce] });
  }
  return [...gruppi.values()].sort((a, b) => posto(a.gruppo.chiave) - posto(b.gruppo.chiave));
};

export const gruppiPerScelta = (campi: readonly string[], nome: (campo: string) => string, risorsa: Risorsa): GruppoOpzioni[] =>
  inGruppi(campi, (c) => c, risorsa).map(({ gruppo, voci }) => ({
    chiave: gruppo.chiave,
    nome: gruppo.nome,
    icona: gruppo.icona,
    opzioni: voci.map((c) => ({ valore: c, etichetta: nome(c) })),
  }));

const piano = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

export const corrisponde = (nome: string, gruppo: GruppoCampi, cercato: string): boolean => {
  const parola = piano(cercato);
  return !parola || piano(nome).includes(parola) || piano(gruppo.parole).includes(parola);
};
