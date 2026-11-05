import { createElement, type ReactNode } from "react";
import type { Editore } from "@/crm/viste/Tabella/editor";
import type { Stato } from "./celle";
import type { Destino, EsitoModifica, ModificaCella } from "./CellaCrm";
import { SuPiuRecente } from "./segue";

type Riga = { id: string | number };
type Chiave<R> = keyof R & string;

const TESTO: Editore = { tipo: "testo", opzioni: [], svuotabile: true };
const pulito = (v: unknown) => (typeof v === "string" ? v.trim() : (v ?? ""));
const conChiave =
  <R,>(chiave: string) =>
  (r: R, v: unknown): R => ({ ...r, [chiave]: v });

const testoSu = <R,>(r: R, risorsa: Destino["risorsa"], id: string, colonna: string, chiave: string, altro: Partial<ModificaCella<R>> = {}): ModificaCella<R> => ({
  editore: { ...TESTO },
  valore: (r as Record<string, unknown>)[chiave],
  scrivi: (v) => ({ risorsa, id, data: { [colonna]: pulito(v) } }),
  applica: (x, v) => conChiave<R>(chiave)(x, pulito(v)),
  ...altro,
});

export const testoRiga =
  <R extends Riga>(risorsa: Destino["risorsa"], colonna: string, altro: Partial<ModificaCella<R>> = {}) =>
  (r: R): ModificaCella<R> =>
    testoSu(r, risorsa, String(r.id), colonna, colonna, altro);

export const nomeRiga = <R extends Riga>(risorsa: Destino["risorsa"]) =>
  testoRiga<R>(risorsa, "nome", { soloMatita: true, valida: (v) => (pulito(v) ? null : "Il nome non può restare vuoto"), editore: { ...TESTO, svuotabile: false } });

export const valoreRiga =
  <R extends Riga>(risorsa: Destino["risorsa"], colonna: string, editore: ModificaCella<R>["editore"], leggi?: (r: R) => unknown, applica?: (r: R, v: unknown) => R) =>
  (r: R): ModificaCella<R> => ({
    editore,
    valore: leggi ? leggi(r) : (r as Record<string, unknown>)[colonna],
    scrivi: (v) => ({ risorsa, id: String(r.id), data: { [colonna]: v === "" || v === undefined ? null : v } }),
    applica: applica ?? conChiave<R>(colonna),
  });

const SENZA_AZIENDA = "Questa riga non ha un'azienda: collegala prima, poi si scrive qui";

export const campoAzienda =
  <R extends { azienda_id?: string | null }>(chiave: Chiave<R>, colonna: string) =>
  (r: R): EsitoModifica<R> =>
    r.azienda_id ? testoSu(r, "aziende", r.azienda_id, colonna, chiave) : { manca: SENZA_AZIENDA };

const SENZA_PERSONA = "Non c'è una persona collegata: si aggiunge dalla scheda";

export const primaDi = (totali: number, nome?: string | null): ReactNode =>
  createElement(
    "span",
    { "data-cella-altre": "", title: `Ci sono ${totali} persone: questa è ${nome ?? "la prima"}, e si scrive lì`, className: "shrink-0 pl-1.5 text-xs whitespace-nowrap text-mute" },
    `prima di ${totali}`,
  );

export const campoPersona =
  <R extends { persona_id?: string | null }>(chiave: Chiave<R>, colonna: string, altre?: (r: R) => { totali?: number; nome?: string | null }) =>
  (r: R): EsitoModifica<R> => {
    if (!r.persona_id) return { manca: SENZA_PERSONA };
    const a = altre?.(r);
    return testoSu(r, "persone", r.persona_id, colonna, chiave, { dove: a?.totali && a.totali > 1 ? primaDi(a.totali, a.nome) : undefined });
  };

export interface SuTrattativa {
  id?: string | null;
  tipo?: string | null;
  altre?: number;
  avvio?: unknown;
  canone?: unknown;
  valore?: unknown;
}

export const vivaDalloStato = (s?: Stato | null): SuTrattativa | null => (s?.trattativa_id && !s.archiviata ? { id: s.trattativa_id, tipo: s.tipo, altre: s.altre_aperte } : null);

const SENZA_TRATTATIVA = "Nessuna trattativa viva: si apre, o si riprende, dalla scheda";
const CHIUSA = "Una trattativa chiusa non ha un prossimo passo";
export const OBBLIGATORIO_PASSO = "Una trattativa aperta ha sempre un prossimo passo: scrivi quello nuovo";

const dove = (t: SuTrattativa) => (t.altre ? createElement(SuPiuRecente, { altre: t.altre }) : undefined);

export const celleTrattativa = <R,>(di: (r: R) => SuTrattativa | null, chiavi: { passo: Chiave<R>; il: Chiave<R> }) => ({
  valore: (r: R): EsitoModifica<R> => {
    const t = di(r);
    if (!t?.id) return { manca: SENZA_TRATTATIVA };
    const id = t.id;
    return {
      editore: { tipo: "valore", opzioni: [], svuotabile: false },
      valore: t.valore,
      testo: t.valore === null || t.valore === undefined ? "" : String(t.valore),
      rigaEditore: { avvio: t.avvio, canone: t.canone },
      scrivi: (v) => ({ risorsa: "trattative", id, data: v as Record<string, unknown> }),
      dove: dove(t),
    };
  },
  passo: (r: R): EsitoModifica<R> => {
    const t = di(r);
    if (!t?.id) return { manca: SENZA_TRATTATIVA };
    return testoSu(r, "trattative", t.id, "prossimo_passo", chiavi.passo, { dove: dove(t), valida: (v) => (t.tipo === "aperta" && !pulito(v) ? OBBLIGATORIO_PASSO : null) });
  },
  il: (r: R): EsitoModifica<R> => {
    const t = di(r);
    if (!t?.id) return { manca: SENZA_TRATTATIVA };
    if (t.tipo !== "aperta") return { manca: CHIUSA };
    const id = t.id;
    return {
      editore: { tipo: "istante", opzioni: [], svuotabile: false },
      valore: (r as Record<string, unknown>)[chiavi.il],
      scrivi: (v) => ({ risorsa: "trattative", id, data: { prossimo_il: v ?? null } }),
      applica: conChiave<R>(chiavi.il),
      dove: dove(t),
    };
  },
});

export const tagRiga =
  <R extends Riga & { tag?: { nome: string }[] }>(oggetto: "azienda" | "persona" | "trattativa") =>
  (r: R): ModificaCella<R> => ({
    editore: { tipo: "scelta", opzioni: [], svuotabile: false },
    valore: null,
    testo: (r.tag ?? []).map((t) => t.nome).join(", "),
    tag: { oggetto, id: String(r.id) },
  });

export const legameRiga =
  <R extends Riga>(risorsa: Destino["risorsa"], fra: "aziende" | "persone", chiave: "azienda_id" | "persona_id", testo: (r: R) => string | null | undefined, altro: Partial<ModificaCella<R>> = {}) =>
  (r: R): ModificaCella<R> => ({
    editore: { tipo: "legame", opzioni: [], svuotabile: true, fra },
    valore: (r as Record<string, unknown>)[chiave],
    testo: testo(r) ?? "",
    scrivi: (v) => ({ risorsa, id: String(r.id), data: { [chiave]: v || null } }),
    ...altro,
  });
