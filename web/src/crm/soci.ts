import { useCallback, useMemo } from "react";
import { useGetList } from "ra-core";

export interface Socio {
  id: string;
  email: string;
  nome?: string | null;
}

const SENZA = { page: 1, perPage: 100 };
const PER_NOME = { field: "nome", order: "ASC" as const };

export const useSoci = () => {
  const { data } = useGetList<Socio>("soci", { pagination: SENZA, sort: PER_NOME });
  const nomi = useMemo(() => new Map((data ?? []).map((s) => [s.email.toLowerCase(), s.nome || s.email])), [data]);
  const nomeDi = useCallback(
    (email?: string | null) => (email ? (nomi.get(email.toLowerCase()) ?? email) : ""),
    [nomi],
  );
  return { soci: data ?? [], nomeDi };
};
