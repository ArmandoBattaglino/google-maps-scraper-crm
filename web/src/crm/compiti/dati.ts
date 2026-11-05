import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import type { DatiDaDove } from "@/crm/colonne/daDove";
import type { Stato, Ultima } from "@/crm/colonne/celle";
import { oggi } from "@/crm/attivita/tempo";
import { chiedi } from "@/crm/chiama/api";
import type { DatiCrm } from "@/providers/dati";

export type Chi = "miei" | "team";
export type StatoCompiti = "da_fare" | "fatti";
export type Legame = "trattativa" | "persona" | "azienda";

export interface RigaCompito {
  id: string;
  testo: string;
  scadenza: string | null;
  fatto_il: string | null;
  quando: string;
  creato_da: string | null;
  assegnato: string | null;
  legame: Legame;
  azienda_id: string | null;
  azienda_nome: string | null;
  azienda_telefono: string | null;
  persona_id: string | null;
  persona_nome: string | null;
  persona_telefono: string | null;
  trattativa_id: string | null;
  fase_id: string | null;
  fase_nome: string | null;
  percorso_nome: string | null;
  trattativa_archiviata: string | null;
  prossimo_passo: string | null;
  prossimo_il: string | null;
  stato?: Stato | null;
  da_dove?: DatiDaDove | null;
  ultima?: Ultima | null;
}

export interface GruppoCompiti {
  chiave: string;
  n: number;
  righe: RigaCompito[];
}

export interface ElencoCompiti {
  totale: number;
  entro_oggi: number;
  gruppi: GruppoCompiti[];
}

export interface Richiesta {
  chi: Chi;
  stato: StatoCompiti;
  q: string;
  giorno: string;
  ordine: string | null;
  dir: "asc" | "desc" | null;
  extra: string[];
  limiti: Record<string, number>;
}

export const useGiorno = () => {
  const [giorno, setGiorno] = useState(oggi);
  useEffect(() => {
    const timer = setInterval(() => setGiorno(oggi()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return giorno;
};

const inParametri = (r: Richiesta) => {
  const p = new URLSearchParams({ di: r.chi === "team" ? "team" : "me", stato: r.stato, giorno: r.giorno });
  if (r.q) p.set("q", r.q);
  if (r.ordine) p.set("ordine", r.ordine);
  if (r.dir) p.set("dir", r.dir);
  if (r.extra.length) p.set("extra", r.extra.join(","));
  if (Object.keys(r.limiti).length) p.set("limiti", JSON.stringify(r.limiti));
  return p;
};

export const useElencoCompiti = (r: Richiesta) =>
  useQuery({
    queryKey: ["compiti", "elenco", r],
    queryFn: ({ signal }) => chiedi<ElencoCompiti>(`/compiti/elenco?${inParametri(r)}`, { signal }),
    placeholderData: keepPreviousData,
    retry: 1,
  });

export const useDovuti = (giorno: string) =>
  useQuery({
    queryKey: ["attivita", "compiti-dovuti", giorno],
    queryFn: ({ signal }) => chiedi<{ n: number }>(`/compiti/dovuti?giorno=${giorno}`, { signal }),
    placeholderData: keepPreviousData,
    retry: 1,
  });

export const useModificaCompito = () => {
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  return async (id: string, dati: Record<string, unknown>) => {
    try {
      await dp.patch("attivita", { id, data: dati });
    } catch (e) {
      notify(`Compito non aggiornato: ${e instanceof Error && e.message ? e.message : "il server non risponde"}.`, { type: "error" });
      return false;
    }
    await Promise.all([qc.invalidateQueries({ queryKey: ["compiti"] }), qc.invalidateQueries({ queryKey: ["attivita"] })]);
    return true;
  };
};

export interface Collegabile {
  tipo: Legame;
  id: string;
  nome: string;
  dettaglio: string;
  azienda_id: string | null;
  persona_id: string | null;
  trattativa_id: string | null;
}

export const useCollegabili = (q: string) =>
  useQuery({
    queryKey: ["compiti", "collegabili", q],
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => chiedi<{ righe: Collegabile[] }>(`/compiti/collegabili?${new URLSearchParams({ q })}`, { signal }),
  });
