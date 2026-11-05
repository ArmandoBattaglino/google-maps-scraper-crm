import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { EsitoModifica } from "./CellaCrm";

export interface Colonna<R> {
  id: string;
  etichetta: string;
  ordina?: string;
  fermaOrdine?: boolean;
  largo?: string;
  nascosta?: boolean;
  cella: (riga: R) => ReactNode;
  modifica?: (riga: R) => EsitoModifica<R> | null;
}

interface Scelta {
  visibili: string[];
  nascoste: string[];
  larghezze?: Record<string, number>;
}

const chiave = (tabella: string) => `crm.colonne.${tabella}`;

const leggi = (tabella: string): Scelta | null => {
  try {
    const v = JSON.parse(localStorage.getItem(chiave(tabella)) ?? "null") as Scelta | null;
    return v && Array.isArray(v.visibili) && Array.isArray(v.nascoste) ? v : null;
  } catch {
    return null;
  }
};

const salva = (tabella: string, scelta: Scelta | null) => {
  try {
    if (scelta) localStorage.setItem(chiave(tabella), JSON.stringify(scelta));
    else localStorage.removeItem(chiave(tabella));
  } catch {
  }
};

export const useColonne = <R,>(tabella: string, tutte: Colonna<R>[]) => {
  const [scelta, setScelta] = useState<Scelta | null>(() => leggi(tabella));

  const [prima, ...altre] = tutte;
  const visibili = useMemo(() => {
    if (!prima) return [];
    if (!scelta) return tutte.filter((c, i) => i === 0 || !c.nascosta);
    const perId = new Map(altre.map((c) => [c.id, c]));
    const scelte = scelta.visibili.flatMap((id) => perId.get(id) ?? []);
    const conosciute = new Set([...scelta.visibili, ...scelta.nascoste]);
    return [prima, ...scelte, ...altre.filter((c) => !conosciute.has(c.id) && !c.nascosta)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutte, scelta]);
  const nascoste = useMemo(() => {
    const viste = new Set(visibili.map((c) => c.id));
    return tutte.filter((c) => !viste.has(c.id));
  }, [tutte, visibili]);

  const cambia = useCallback(
    (ids: string[], tolte: string[]) => {
      const nuova = { visibili: ids, nascoste: tolte, larghezze: scelta?.larghezze };
      salva(tabella, nuova);
      setScelta(nuova);
    },
    [tabella, scelta],
  );

  const idDi = (cs: Colonna<R>[]) => cs.map((c) => c.id);
  const senzaPrima = idDi(visibili).slice(1);
  const mostra = (id: string) =>
    cambia([...senzaPrima, id], idDi(nascoste).filter((x) => x !== id));
  const nascondi = (id: string) =>
    cambia(senzaPrima.filter((x) => x !== id), [...idDi(nascoste), id]);
  const sposta = (i: number, verso: number) => {
    const copia = [...senzaPrima];
    copia.splice(i + verso, 0, ...copia.splice(i, 1));
    cambia(copia, idDi(nascoste));
  };
  const ordina = (ids: string[]) => cambia(ids, idDi(nascoste));
  const allarga = (id: string, larghezza: number | undefined) => {
    const larghezze = { ...scelta?.larghezze };
    if (larghezza) larghezze[id] = larghezza;
    else delete larghezze[id];
    const nuova = { visibili: senzaPrima, nascoste: idDi(nascoste), larghezze };
    salva(tabella, nuova);
    setScelta(nuova);
  };
  const ripristina = () => {
    salva(tabella, null);
    setScelta(null);
  };

  return { visibili, nascoste, mostra, nascondi, sposta, ordina, allarga, larghezze: scelta?.larghezze ?? {}, ripristina, cambiata: scelta !== null };
};

export type StatoColonne<R> = ReturnType<typeof useColonne<R>>;
