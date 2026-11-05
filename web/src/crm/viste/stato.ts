import { ENTITA } from "@/crm/entita";

export const RISORSE = ENTITA;
export type Risorsa = (typeof RISORSE)[number];

export const TUTTE: Record<Risorsa, string> = {
  aziende: "Tutte le aziende",
  persone: "Tutte le persone",
  trattative: "Tutte le trattative",
  attivita: "Tutte le attività",
};

export const MODI = ["tabella", "kanban", "calendario", "mappa"] as const;
export type Modo = (typeof MODI)[number];

export interface Condizione {
  campo: string;
  op: string;
  valore?: unknown;
}
export type Gruppo = { e: Nodo[] } | { o: Nodo[] };
export type Nodo = Condizione | Gruppo;

export interface Ordine {
  campo: string;
  dir: "asc" | "desc";
}
export interface Colonna {
  campo: string;
  totale?: string;
  larghezza?: number;
}

export interface StatoVista {
  risorsa: Risorsa;
  modo: Modo;
  filtri: Gruppo;
  ordine: Ordine[];
  gruppi: string[];
  colonne: Colonna[];
  campo_data: string | null;
}

export interface Vista {
  id: string;
  nome: string;
  tabella: Risorsa;
  di: string;
  tipo: Modo;
  filtri: unknown;
  ordine: Ordine[] | null;
  gruppo: string | null;
  colonne: (string | Colonna)[] | null;
  campo_data: string | null;
  usi?: number;
}

const vuoto = (): Gruppo => ({ e: [] });

const senzaOrigine = (colonne: Colonna[]): Colonna[] => colonne.filter((c) => c.campo !== "origine");
const NON_ARCHIVIATA: Condizione = { campo: "archiviata_il", op: "vuoto" };

const PARTENZA: Record<Risorsa, { colonne: string[]; ordine: Ordine[]; filtri: () => Gruppo; data: string | null }> = {
  aziende: {
    colonne: ["nome", "stato", "comune", "categoria", "telefono", "sito", "richiamare_il", "scheda.segue"],
    ordine: [{ campo: "nome", dir: "asc" }],
    filtri: vuoto,
    data: "richiamare_il",
  },
  persone: {
    colonne: ["nome", "ruolo", "stato", "azienda.nome", "telefono", "email", "aggiornato"],
    ordine: [{ campo: "nome", dir: "asc" }],
    filtri: () => ({ e: [NON_ARCHIVIATA] }),
    data: null,
  },
  trattative: {
    colonne: ["azienda.nome", "persona.nome", "fase.nome", "valore", "prossimo_passo", "prossimo_il", "ultima_nota", "segue", "temperatura"],
    ordine: [{ campo: "prossimo_il", dir: "asc" }],
    filtri: () => ({ e: [NON_ARCHIVIATA] }),
    data: "prossimo_il",
  },
  attivita: {
    colonne: ["tipo", "azienda.nome", "persona.nome", "esito", "testo", "scadenza", "quando", "creato_da"],
    ordine: [{ campo: "quando", dir: "desc" }],
    filtri: vuoto,
    data: "scadenza",
  },
};

export const statoDiPartenza = (risorsa: Risorsa): StatoVista => {
  const p = PARTENZA[risorsa];
  return {
    risorsa,
    modo: "tabella",
    filtri: p.filtri(),
    ordine: p.ordine,
    gruppi: [],
    colonne: p.colonne.map((campo) => ({ campo })),
    campo_data: p.data,
  };
};

const comeGruppo = (f: unknown): Gruppo => {
  if (f && typeof f === "object" && !Array.isArray(f)) {
    if ("e" in f || "o" in f) return f as Gruppo;
    if ("campo" in f) return { e: [f as Condizione] };
  }
  return vuoto();
};

const colonneDiVista = (v: Vista): Colonna[] => {
  const scelte = senzaOrigine((v.colonne ?? []).map((c) => (typeof c === "string" ? { campo: c } : c)));
  return scelte.length ? scelte : statoDiPartenza(v.tabella).colonne;
};

export const statoDiVista = (v: Vista): StatoVista => ({
  risorsa: v.tabella,
  modo: v.tipo,
  filtri: comeGruppo(v.filtri),
  ordine: v.ordine ?? [],
  gruppi: v.gruppo?.trim() ? v.gruppo.split(",").map((s) => s.trim()) : [],
  colonne: colonneDiVista(v),
  campo_data: v.campo_data,
});

export const corpoVista = (s: StatoVista) => ({
  tabella: s.risorsa,
  tipo: s.modo,
  filtri: s.filtri,
  ordine: s.ordine,
  gruppo: s.gruppi.join(",") || null,
  colonne: s.colonne.map((c) => (c.totale || c.larghezza ? c : c.campo)),
  campo_data: s.campo_data,
});

interface InIndirizzo {
  f: Gruppo;
  o: Ordine[];
  g: string[];
  c: Colonna[];
  d: string | null;
  m: Modo;
}

export const scriviStato = (s: StatoVista): string =>
  JSON.stringify({ f: s.filtri, o: s.ordine, g: s.gruppi, c: s.colonne, d: s.campo_data, m: s.modo } satisfies InIndirizzo);

export const leggiStato = (testo: string | null, base: StatoVista): StatoVista => {
  if (!testo) return base;
  try {
    const x = JSON.parse(testo) as Partial<InIndirizzo>;
    return {
      risorsa: base.risorsa,
      modo: x.m && MODI.includes(x.m) ? x.m : base.modo,
      filtri: x.f ? comeGruppo(x.f) : base.filtri,
      ordine: Array.isArray(x.o) ? x.o : base.ordine,
      gruppi: Array.isArray(x.g) ? x.g : base.gruppi,
      colonne: Array.isArray(x.c) ? senzaOrigine(x.c) : base.colonne,
      campo_data: x.d === undefined ? base.campo_data : x.d,
    };
  } catch {
    return base;
  }
};

export const statiUguali = (a: StatoVista, b: StatoVista): boolean => scriviStato(a) === scriviStato(b);
