import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { Fase as FormaFase } from "@/components/crm/forme";

export const TUTTE = { page: 1, perPage: 1000 };

export interface Fase {
  id: string;
  nome: string;
  ordine: number;
  tipo: string;
  percorso: string;
}

export const useFasi = () => {
  const { data } = useGetList<Fase>("fasi", { pagination: TUTTE, sort: { field: "ordine", order: "ASC" } });
  return useMemo(() => new Map((data ?? []).map((f) => [f.id, f])), [data]);
};

export const formaFase = (f?: Fase): FormaFase => {
  if (f?.tipo === "cliente") return "firmato";
  if (f?.tipo === "perso") return "perso";
  return f?.ordine === 1 ? "nuovo" : "contattato";
};

export interface Socio {
  id: string;
  email: string;
  nome?: string | null;
}

export const useSoci = () => {
  const { data } = useGetList<Socio>("soci", { pagination: { page: 1, perPage: 100 }, sort: { field: "nome", order: "ASC" } });
  return useMemo(() => data ?? [], [data]);
};

export const nomeDi = (soci: Socio[], email?: string | null): string => {
  if (!email) return "";
  return soci.find((s) => s.email === email)?.nome || email;
};

export const percorsoTrattativa = (id: string) => `/trattative/${id}`;
