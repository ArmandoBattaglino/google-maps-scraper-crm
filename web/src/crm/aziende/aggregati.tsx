import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useGetMany, useListContext } from "ra-core";
import type { Stato, TagRiga, Ultima } from "@/crm/colonne/celle";
import type { DatiDaDove } from "@/crm/colonne/daDove";
import { useFasi } from "@/crm/scheda/dati";

export interface Azienda {
  id: string;
  nome: string;
  contatto_id?: string | null;
  segue?: string | null;
  telefono?: string | null;
  email?: string | null;
  sito?: string | null;
  comune?: string | null;
  categoria?: string | null;
  indirizzo?: string | null;
  piva?: string | null;
  valutazione?: string | number | null;
  recensioni?: number | null;
  tentativi?: number | null;
  ultima_chiamata?: string | null;
  richiamare_il?: string | null;
  chiamato_da?: string | null;
  creato?: string | null;
  creato_da?: string | null;
  aggiornato?: string | null;
  referente?: string | null;
  note?: string | null;
  dominio?: string | null;
  categorie?: string[] | null;
  persona_id?: string | null;
  persona_nome?: string | null;
  trattativa_avvio?: string | number | null;
  trattativa_canone?: string | number | null;
  persona_ruolo?: string | null;
  persona_telefono?: string | null;
  persona_email?: string | null;
  trattativa_valore?: string | number | null;
  trattativa_passo?: string | null;
  trattativa_il?: string | null;
  campi?: Record<string, unknown> | null;
  dati?: { etichetta?: string } | null;
  stato?: Stato | null;
  calcolati?: { tentativi?: number | null; ultima_chiamata?: string | null; chiamato_da?: string | null; richiamare_il?: string | null; segue?: string | null } | null;
  persone?: { id: string; nome: string }[];
  persone_totali?: number;
  trattative_aperte?: number;
  trattative_totali?: number;
  da_dove?: DatiDaDove | null;
  ultima?: Ultima | null;
  ultima_nota?: string | null;
  tag?: TagRiga[];
}

interface Aggregati {
  tipoContatto: (contatto?: string | null) => string | undefined;
}

const Contesto = createContext<Aggregati>({ tipoContatto: () => undefined });
export const useAggregati = () => useContext(Contesto);

export const FornitoreAggregati = ({ children }: { children: ReactNode }) => {
  const { data } = useListContext<Azienda>();
  const contatti = useMemo(() => (data ?? []).flatMap((r) => (r.contatto_id ? [r.contatto_id] : [])), [data]);
  const fasi = useFasi();
  const deiContatti = useGetMany<{ id: string; fase: string }>("contatti", { ids: contatti }, { enabled: contatti.length > 0 });

  const valore = useMemo<Aggregati>(() => {
    const tipi = new Map((deiContatti.data ?? []).map((k) => [String(k.id), fasi.get(k.fase)?.tipo]));
    return { tipoContatto: (k) => (k ? tipi.get(k) : undefined) };
  }, [deiContatti.data, fasi]);

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
};
