import { useEffect, useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUtils, HttpError, useDataProvider, useGetList } from "ra-core";
import { API_URL, type DatiCrm } from "@/providers/dati";
import { ANCHE_NON_AZIENDE, contaCondizioni, parlaDiEtichetta, pulisci } from "./Filtri/albero";
import { corpoVista, type Gruppo, type Ordine, type Risorsa, type StatoVista, type Vista } from "./stato";

export interface VoceCampo {
  campo: string;
  tipo: "testo" | "numero" | "istante" | "data" | "booleano" | "uuid" | "elenco" | "multi";
  operatori: string[];
  ordinabile: boolean;
  raggruppabile: boolean;
  totali: string[];
  calcolato?: boolean;
  legato?: boolean;
  personalizzato?: boolean;
  etichetta?: string;
  tipo_campo?: string;
  opzioni?: (string | { valore: string; colore?: string })[];
  ordine?: number;
}

export type RigaVista = Record<string, unknown> & { id: string };

export interface Richiesta {
  filtri?: Gruppo;
  ordine?: Ordine[];
  gruppi?: string[];
  totali?: { fn: string; campo: string }[];
  colonne?: string[];
  inizio?: number;
  quanti?: number;
}

export interface GruppoRisultato {
  campo: string;
  valore: unknown;
  n: number;
  totali: Record<string, number | string | null>;
  gruppi?: GruppoRisultato[];
}

export interface Risultato {
  righe: RigaVista[];
  totale: number;
  inizio: number;
  quanti: number;
  totali: Record<string, number | string | null>;
  gruppi: GruppoRisultato[];
  gruppi_troncati: boolean;
}

type CorpoErrore = { error?: { message?: string } };

const chiama = async <T>(url: string, opzioni: fetchUtils.Options = {}): Promise<T> => {
  try {
    const { json } = await fetchUtils.fetchJson(url, { ...opzioni, credentials: "same-origin" });
    return json as T;
  } catch (e) {
    if (e instanceof HttpError) {
      const messaggio = (e.body as CorpoErrore | undefined)?.error?.message;
      if (messaggio) throw new HttpError(messaggio, e.status, e.body);
    }
    throw e;
  }
};

export const cerca = (risorsa: Risorsa, richiesta: Richiesta, signal?: AbortSignal): Promise<Risultato> =>
  chiama<Risultato>(`${API_URL}/${risorsa}/cerca`, { method: "POST", body: JSON.stringify(richiesta), signal });

export const useCatalogo = (risorsa: Risorsa) =>
  useQuery({
    queryKey: ["campi_definizioni", "catalogo", risorsa],
    queryFn: () => chiama<{ campi: VoceCampo[] }>(`${API_URL}/${risorsa}/cerca`),
    select: (d) => d.campi,
    retry: false,
  });

const PER_SCRIVERE: Record<string, string[]> = {
  aziende: [],
  persone: ["azienda_id", "archiviata_il"],
  trattative: ["azienda_id", "persona_id", "percorso", "fase_id", "prossimo_passo", "prossimo_il", "avvio", "canone", "archiviata_il"],
  attivita: ["azienda_id", "persona_id", "trattativa_id"],
};

export const colonneDi = (s: StatoVista, altre: string[] = []): string[] => [
  ...new Set([...s.colonne.map((c) => c.campo), ...s.gruppi, ...(s.campo_data ? [s.campo_data] : []), ...PER_SCRIVERE[s.risorsa], ...altre]),
];

export const totaliDi = (s: StatoVista) => s.colonne.filter((c) => c.totale).map((c) => ({ fn: c.totale as string, campo: c.campo }));

export const useCerca = (risorsa: Risorsa, richiesta: Richiesta, attiva = true) =>
  useQuery({
    queryKey: [risorsa, "cerca", richiesta],
    queryFn: ({ signal }) => cerca(risorsa, richiesta, signal),
    placeholderData: keepPreviousData,
    enabled: attiva,
    retry: false,
  });

export const useRighe = (risorsa: Risorsa, richiesta: Richiesta, passo: number, attiva = true) => {
  const q = useInfiniteQuery({
    queryKey: [risorsa, "cerca", "pagine", richiesta, passo],
    queryFn: ({ pageParam, signal }) => cerca(risorsa, { ...richiesta, inizio: pageParam, quanti: passo }, signal),
    initialPageParam: 0,
    getNextPageParam: (ultima, _pagine, inizio) => (inizio + ultima.righe.length < ultima.totale ? inizio + passo : undefined),
    placeholderData: keepPreviousData,
    enabled: attiva,
    retry: false,
  });
  const righe = useMemo(() => q.data?.pages.flatMap((p) => p.righe) ?? [], [q.data]);
  return { ...q, righe, totale: q.data?.pages[0]?.totale ?? 0 };
};

export const leggiFinoA = async (risorsa: Risorsa, richiesta: Richiesta, massimo: number, signal?: AbortSignal) => {
  const righe: RigaVista[] = [];
  let totale = 0;
  for (let inizio = 0; ; inizio += 1000) {
    const r = await cerca(risorsa, { ...richiesta, inizio, quanti: Math.min(1000, massimo - righe.length) }, signal);
    righe.push(...r.righe);
    totale = r.totale;
    if (r.righe.length < 1000 || righe.length >= Math.min(totale, massimo)) return { righe, totale };
  }
};

export const useSegnaleSchede = (risorsa: Risorsa) => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["schede_aziende", "segnale"],
    queryFn: () => Date.now(),
    enabled: risorsa === "aziende",
    staleTime: Infinity,
  });
  useEffect(() => {
    if (data !== undefined) void qc.invalidateQueries({ queryKey: ["aziende", "cerca"] });
  }, [data, qc]);
};

const TUTTE = { page: 1, perPage: 500 };
const PER_NOME = { field: "nome", order: "ASC" as const };

export const useViste = () => useGetList<Vista>("viste", { pagination: TUTTE, sort: PER_NOME });

export const useScriviVista = () => {
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const rileggi = () => qc.invalidateQueries({ queryKey: ["viste"] });
  return {
    crea: async (nome: string, di: string, s: StatoVista) => {
      const { data } = await dp.create<Vista>("viste", { data: { nome, di, ...corpoVista(s) } });
      await rileggi();
      return data;
    },
    salva: async (id: string, s: StatoVista) => {
      await dp.patch("viste", { id, data: corpoVista(s) });
      await rileggi();
    },
    rinomina: async (id: string, nome: string) => {
      await dp.patch("viste", { id, data: { nome } });
      await rileggi();
    },
    togli: async (id: string, prima?: () => void) => {
      await dp.delete<Vista>("viste", { id });
      prima?.();
      await rileggi();
    },
  };
};

export const segnaUso = (id: string) => {
  void chiama(`${API_URL}/viste/${encodeURIComponent(id)}/righe?quanti=0`).catch(() => undefined);
};

export const haFiltri = (s: StatoVista) => contaCondizioni(pulisci(s.filtri)) > 0;

export const useConteggi = (s: StatoVista) => {
  const filtri = pulisci(s.filtri);
  const filtrate = useCerca(s.risorsa, { filtri, quanti: 0 });
  const tutte = useCerca(s.risorsa, parlaDiEtichetta(filtri) ? { filtri: { e: [ANCHE_NON_AZIENDE] }, quanti: 0 } : { quanti: 0 }, haFiltri(s));
  return { filtrate: filtrate.data?.totale, tutte: haFiltri(s) ? tutte.data?.totale : undefined };
};
