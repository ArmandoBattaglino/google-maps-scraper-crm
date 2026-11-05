import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetList, useNotify } from "ra-core";
import type { DatiCrm } from "@/providers/dati";
import { erroreDi, RISORSA, type Definizione, type Oggetto, type Opzione, type Tipo } from "./tipi";

const TUTTE = { page: 1, perPage: 1000 };
const PASSO = 10;

export interface NuovoCampo {
  chiave: string;
  etichetta: string;
  tipo: Tipo;
  opzioni: Opzione[];
}

export const useCampi = (oggetto: Oggetto) => {
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const { data, isPending, error, refetch } = useGetList<Definizione>(RISORSA, {
    pagination: TUTTE,
    sort: { field: "ordine", order: "ASC" },
  });
  const [ordineLocale, setOrdineLocale] = useState<string[] | null>(null);

  const conteggi = useMemo(() => {
    const n: Record<string, number> = {};
    for (const d of data ?? []) if (!d.archiviato_il) n[d.oggetto] = (n[d.oggetto] ?? 0) + 1;
    return n;
  }, [data]);
  const tutte = useMemo(() => (data ?? []).filter((d) => d.oggetto === oggetto), [data, oggetto]);
  const archiviati = useMemo(() => tutte.filter((d) => d.archiviato_il), [tutte]);
  const attivi = useMemo(() => {
    const lista = tutte.filter((d) => !d.archiviato_il);
    if (!ordineLocale) return lista;
    const posto = (d: Definizione) => {
      const i = ordineLocale.indexOf(d.id);
      return i < 0 ? ordineLocale.length : i;
    };
    return [...lista].sort((a, b) => posto(a) - posto(b));
  }, [tutte, ordineLocale]);

  const rileggi = () => qc.invalidateQueries({ queryKey: [RISORSA] });

  const crea = async (campo: NuovoCampo) => {
    const ultimo = Math.max(0, ...tutte.map((d) => d.ordine));
    try {
      await dp.create(RISORSA, { data: { oggetto, ...campo, ordine: ultimo + PASSO } });
    } finally {
      await rileggi();
    }
    notify("Campo creato", { type: "success" });
  };

  const modifica = async (campo: Definizione, dati: { etichetta: string; opzioni?: Opzione[] }) => {
    await dp.update(RISORSA, { id: campo.id, data: dati, previousData: campo });
    await rileggi();
    notify("Campo salvato", { type: "success" });
  };

  const archivia = async (campo: Definizione) => {
    await dp.archivia(RISORSA, { id: campo.id });
    await rileggi();
    notify(`«${campo.etichetta}» archiviato: i valori restano nelle righe`, { type: "info" });
  };

  const ripristina = async (campo: Definizione) => {
    await dp.ripristina(RISORSA, { id: campo.id });
    await rileggi();
    notify(`«${campo.etichetta}» ripristinato`, { type: "success" });
  };

  const desiderata = useRef<Definizione[] | null>(null);
  const noti = useRef(new Map<string, number>());
  const inCorso = useRef(false);

  const riordina = async (lista: Definizione[]) => {
    setOrdineLocale(lista.map((d) => d.id));
    desiderata.current = lista;
    if (inCorso.current) return;
    inCorso.current = true;
    try {
      while (desiderata.current) {
        const giro: Definizione[] = desiderata.current;
        desiderata.current = null;
        await Promise.all(
          giro.map((d, i) => {
            const ordine = (i + 1) * PASSO;
            if ((noti.current.get(d.id) ?? d.ordine) === ordine) return null;
            noti.current.set(d.id, ordine);
            return dp.update(RISORSA, { id: d.id, data: { ordine }, previousData: d });
          }),
        );
      }
    } catch (e) {
      notify(erroreDi(e).messaggio, { type: "error" });
    } finally {
      await rileggi();
      desiderata.current = null;
      noti.current.clear();
      inCorso.current = false;
      setOrdineLocale(null);
    }
  };

  return { attivi, archiviati, tutte, conteggi, isPending, error, refetch, crea, modifica, archivia, ripristina, riordina };
};

export type Campi = ReturnType<typeof useCampi>;
