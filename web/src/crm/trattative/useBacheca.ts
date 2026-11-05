import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useGetList, type DataProvider } from "ra-core";
import { useAziende, usePersone } from "@/crm/nomi";
import { SEMPRE_APERTE, type FaseRiga, type Percorso, type Trattativa } from "./tipi";

export const CHIAVE_BACHECA = ["trattative", "bacheca"] as const;

const PAGINA = 1000;
const PER_ORDINE = { field: "ordine", order: "ASC" as const };
const TUTTE = { page: 1, perPage: 200 };

const leggiTutte = async (
  dp: DataProvider,
  percorso: string,
  segue: string | null,
  tag: string | null,
): Promise<Trattativa[]> => {
  const filter = { ...SEMPRE_APERTE, percorso, ...(segue ? { segue } : {}), ...(tag ? { tag } : {}) };
  const righe: Trattativa[] = [];
  for (let page = 1; ; page++) {
    const { data, total } = await dp.getList<Trattativa>("trattative", {
      filter,
      pagination: { page, perPage: PAGINA },
      sort: { field: "creato", order: "ASC" },
    });
    righe.push(...data);
    if (data.length < PAGINA || righe.length >= (total ?? 0)) return righe;
  }
};

export const useFasi = () => {
  const percorsi = useGetList<Percorso>("percorsi", { pagination: TUTTE, sort: PER_ORDINE });
  const fasi = useGetList<FaseRiga>("fasi", { pagination: TUTTE, sort: PER_ORDINE });
  return {
    percorsi: percorsi.data ?? [],
    fasi: fasi.data ?? [],
    inCaricamento: percorsi.isPending || fasi.isPending,
    errore: percorsi.error ?? fasi.error,
  };
};

export const usePercorsiUsati = (percorsi: Percorso[]) => {
  const dp = useDataProvider();
  return useQuery({
    queryKey: ["trattative", "percorsi-usati", percorsi.map((p) => p.id)],
    enabled: percorsi.length > 0,
    queryFn: async () => {
      const conti = await Promise.all(
        percorsi.map((p) =>
          dp.getList<Trattativa>("trattative", {
            filter: { ...SEMPRE_APERTE, percorso: p.id },
            pagination: { page: 1, perPage: 1 },
            sort: { field: "creato", order: "ASC" },
          }),
        ),
      );
      return percorsi.filter((_, i) => (conti[i].total ?? conti[i].data.length) > 0);
    },
  });
};

export const useBacheca = (percorso: string | undefined, segue: string | null, tag: string | null = null) => {
  const dp = useDataProvider();
  const q = useQuery({
    queryKey: [...CHIAVE_BACHECA, percorso, segue, tag],
    queryFn: () => leggiTutte(dp, percorso as string, segue, tag),
    enabled: !!percorso,
    placeholderData: (prima) => prima,
  });
  const righe = q.data;
  const idAziende = useMemo(() => (righe ?? []).map((t) => t.azienda_id), [righe]);
  const idPersone = useMemo(() => (righe ?? []).map((t) => t.persona_id), [righe]);
  return {
    righe: righe ?? [],
    inCaricamento: q.isPending,
    errore: q.error,
    riprova: q.refetch,
    aziende: useAziende(idAziende),
    persone: usePersone(idPersone),
  };
};
