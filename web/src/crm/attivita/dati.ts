import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useCreate, useDelete, useGetList, useGetOne, useNotify, useUpdate } from "ra-core";
import type { Attivita, Legami, Soggetto, TipoAttivita } from "./campi";

export const useAttivita = (soggetto: Soggetto, tipo: TipoAttivita | null, quante: number) =>
  useGetList<Attivita>(
    "attivita",
    {
      filter: { ...soggetto, ...(tipo ? { tipo } : {}) },
      sort: { field: "quando", order: "DESC" },
      pagination: { page: 1, perPage: quante },
    },
    { placeholderData: keepPreviousData },
  );

type RigaLegata = { id: string; azienda_id?: string | null; persona_id?: string | null };

export const useLegami = (s: Soggetto) => {
  const t = useGetOne<RigaLegata>("trattative", { id: s.trattativa_id ?? "" }, { enabled: Boolean(s.trattativa_id) });
  const personaId = s.persona_id ?? t.data?.persona_id ?? null;
  const p = useGetOne<RigaLegata>("persone", { id: personaId ?? "" }, { enabled: Boolean(personaId) });
  const aziendaId = s.azienda_id ?? t.data?.azienda_id ?? p.data?.azienda_id ?? null;
  const a = useGetOne<RigaLegata>("aziende", { id: aziendaId ?? "" }, { enabled: Boolean(aziendaId) });
  const legami: Legami = { azienda_id: aziendaId, persona_id: personaId, trattativa_id: s.trattativa_id ?? null };
  return {
    legami,
    pronti: !t.isLoading && !p.isLoading && !a.isLoading,
  };
};

export const useNomi = () => {
  const { data } = useGetList<{ id: string; email: string; nome: string }>(
    "soci",
    { pagination: { page: 1, perPage: 200 }, sort: { field: "email", order: "ASC" }, filter: {} },
    { staleTime: 5 * 60_000 },
  );
  return (email: string | null) => {
    if (!email) return null;
    return data?.find((s) => s.email === email)?.nome || email.split("@")[0];
  };
};

export const useFasi = (servono: boolean) => {
  const { data } = useGetList<{ id: string; nome: string }>(
    "fasi_lead",
    { pagination: { page: 1, perPage: 200 }, sort: { field: "ordine", order: "ASC" }, filter: {} },
    { enabled: servono, staleTime: 5 * 60_000 },
  );
  return (id: string | null) => data?.find((f) => f.id === id)?.nome ?? id ?? "";
};

const useRilettura = () => {
  const qc = useQueryClient();
  return () => {
    for (const risorsa of ["attivita", "compiti", "aziende", "trattative"]) {
      void qc.invalidateQueries({ queryKey: [risorsa] });
    }
  };
};

const motivo = (e: unknown) => (e instanceof Error && e.message ? e.message : "il server non risponde");

export const useRegistra = () => {
  const [create, { isPending }] = useCreate();
  const notify = useNotify();
  const rileggi = useRilettura();
  const registra = async (dati: Partial<Attivita>) => {
    try {
      await create("attivita", { data: dati }, { returnPromise: true });
      rileggi();
      return true;
    } catch (e) {
      notify(`Attività non salvata: ${motivo(e)}. Il testo è ancora qui, riprova.`, { type: "error" });
      return false;
    }
  };
  return { registra, salvando: isPending };
};

export const useElimina = () => {
  const [cancella, { isPending }] = useDelete();
  const notify = useNotify();
  const rileggi = useRilettura();
  const togli = async (a: Pick<Attivita, "id">) => {
    try {
      await cancella("attivita", { id: a.id, previousData: a }, { returnPromise: true });
      rileggi();
      return true;
    } catch (e) {
      notify(`Riga non eliminata: ${motivo(e)}.`, { type: "error" });
      return false;
    }
  };
  return { togli, togliendo: isPending };
};

export const useFatto = () => {
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const rileggi = useRilettura();
  const segna = async (a: Pick<Attivita, "id">, fatto: boolean) => {
    try {
      const fatto_il = fatto ? new Date().toISOString() : null;
      await update("attivita", { id: a.id, data: { fatto_il }, previousData: a }, { returnPromise: true });
      rileggi();
      return true;
    } catch (e) {
      notify(`Compito non aggiornato: ${motivo(e)}.`, { type: "error" });
      return false;
    }
  };
  return { segna, salvando: isPending };
};
