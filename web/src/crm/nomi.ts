import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider, type DataProvider } from "ra-core";

export interface Azienda {
  id: string;
  nome: string;
  comune?: string | null;
  telefono?: string | null;
  telefono_norm?: string | null;
}

export interface Persona {
  id: string;
  nome: string;
  ruolo?: string | null;
  telefono?: string | null;
  telefono_norm?: string | null;
  azienda_id?: string | null;
}

const A_BLOCCHI = 150;

const leggiMolti = async <R extends { id: string }>(dp: DataProvider, risorsa: string, ids: string[]): Promise<R[]> => {
  const blocchi: string[][] = [];
  for (let i = 0; i < ids.length; i += A_BLOCCHI) blocchi.push(ids.slice(i, i + A_BLOCCHI));
  const risposte = await Promise.all(blocchi.map((b) => dp.getMany<R>(risorsa, { ids: b })));
  return risposte.flatMap((r) => r.data);
};

const senzaDoppi = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((x): x is string => !!x))].sort();

const useRighe = <R extends { id: string }>(risorsa: string, ids: (string | null | undefined)[]) => {
  const dp = useDataProvider();
  const unici = useMemo(() => senzaDoppi(ids), [ids]);
  const { data } = useQuery({
    queryKey: [risorsa, "per-id", unici],
    queryFn: () => leggiMolti<R>(dp, risorsa, unici),
    enabled: unici.length > 0,
    placeholderData: (prima) => prima,
  });
  return useMemo(() => new Map((data ?? []).map((r) => [r.id, r])), [data]);
};

export const useAziende = (ids: (string | null | undefined)[]) => useRighe<Azienda>("aziende", ids);
export const usePersone = (ids: (string | null | undefined)[]) => useRighe<Persona>("persone", ids);
