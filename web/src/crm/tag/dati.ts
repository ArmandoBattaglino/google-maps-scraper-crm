import { useGetList } from "ra-core";

export const erroreDi = (e: unknown) => (e instanceof Error && e.message ? e.message : "riprova");

export type OggettoTag = "azienda" | "persona" | "trattativa";

export interface Tag {
  id: string;
  nome: string;
  colore: string;
}

export interface TagSu {
  id: string;
  tag_id: string;
  oggetto: OggettoTag;
  oggetto_id: string;
}

const TUTTI = { page: 1, perPage: 1000 };

export const useTuttiITag = () =>
  useGetList<Tag>("tag", { pagination: TUTTI, sort: { field: "nome", order: "ASC" } });

export const useTagSu = (oggetto: OggettoTag, oggettoId: string) =>
  useGetList<TagSu>("tag_su", {
    filter: { oggetto, oggetto_id: oggettoId },
    pagination: TUTTI,
    sort: { field: "creato", order: "ASC" },
  });
