import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CircleDot,
  Euro,
  Hash,
  Link2,
  ListChecks,
  Mail,
  Phone,
  ToggleLeft,
  Type,
} from "lucide-react";
import { inOrdine, type Entita } from "@/crm/entita";

export const RISORSA = "campi_definizioni";

export type Oggetto = "azienda" | "persona" | "trattativa";
export type Tipo = "testo" | "numero" | "data" | "scelta" | "multi" | "booleano" | "link" | "telefono" | "email" | "valuta";
export type Opzione = string | { valore: string; colore?: string };

export interface Definizione {
  id: string;
  oggetto: Oggetto;
  chiave: string;
  etichetta: string;
  tipo: Tipo;
  opzioni: Opzione[];
  ordine: number;
  archiviato_il: string | null;
}

export const OGGETTI: { id: Oggetto; entita: Entita; nome: string; riga: string; dette: string }[] = inOrdine(
  [
    { id: "azienda", entita: "aziende", nome: "Aziende", riga: "ogni azienda", dette: "sulle aziende" },
    { id: "persona", entita: "persone", nome: "Persone", riga: "ogni persona", dette: "sulle persone" },
    { id: "trattativa", entita: "trattative", nome: "Trattative", riga: "ogni trattativa", dette: "sulle trattative" },
  ],
  (o) => o.entita,
);

export const TIPI: { id: Tipo; nome: string; icona: LucideIcon }[] = [
  { id: "testo", nome: "Testo", icona: Type },
  { id: "numero", nome: "Numero", icona: Hash },
  { id: "valuta", nome: "Valuta", icona: Euro },
  { id: "data", nome: "Data", icona: Calendar },
  { id: "scelta", nome: "Scelta singola", icona: CircleDot },
  { id: "multi", nome: "Scelta multipla", icona: ListChecks },
  { id: "booleano", nome: "Sì o no", icona: ToggleLeft },
  { id: "link", nome: "Link", icona: Link2 },
  { id: "telefono", nome: "Telefono", icona: Phone },
  { id: "email", nome: "Email", icona: Mail },
];

export const tipoDi = (id: Tipo) => TIPI.find((t) => t.id === id) ?? TIPI[0];
export const conOpzioni = (tipo: Tipo) => tipo === "scelta" || tipo === "multi";
export const valoreDi = (o: Opzione) => (typeof o === "string" ? o : o.valore);

const MAX_CHIAVE = 40;

export const chiaveDa = (etichetta: string): string => {
  const base = etichetta
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) return "campo";
  const conLettera = /^[a-z]/.test(base) ? base : `c_${base}`;
  return conLettera.slice(0, MAX_CHIAVE).replace(/_+$/, "");
};

export const chiaveLibera = (chiave: string, prese: string[]): string => {
  for (let n = 2; ; n++) {
    const coda = `_${n}`;
    const prova = `${chiave.slice(0, MAX_CHIAVE - coda.length).replace(/_+$/, "")}${coda}`;
    if (!prese.includes(prova)) return prova;
  }
};

export interface ErroreCampo {
  messaggio: string;
  codice?: string;
  usate?: { valore: string; righe: number }[];
}

export const erroreDi = (e: unknown): ErroreCampo => {
  const x = e as { message?: string; body?: { error?: { code?: string; usate?: ErroreCampo["usate"] } } };
  return {
    messaggio: x?.message || "Salvataggio non riuscito: riprova.",
    codice: x?.body?.error?.code,
    usate: x?.body?.error?.usate,
  };
};
