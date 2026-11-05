import { useDataProvider, useGetMany } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";

export interface SchedaAzienda {
  id: string;
  azienda_id: string;
  segue?: string | null;
  campi?: Record<string, unknown>;
}

export const useSchedaAzienda = (azienda: string) => {
  const dp = useDataProvider();
  const qc = useQueryClient();
  const { data } = useGetMany<SchedaAzienda>("schede_aziende", { ids: [azienda] });
  const scheda = data?.[0];
  const salva = async (dati: Partial<SchedaAzienda>) => {
    if (scheda) await dp.update("schede_aziende", { id: azienda, data: dati, previousData: scheda });
    else await dp.create("schede_aziende", { data: { azienda_id: azienda, ...dati } });
    await qc.invalidateQueries({ queryKey: ["schede_aziende"] });
  };
  return { scheda, salva };
};
