import { useQuery } from "@tanstack/react-query";

const MARCA_URL = "/crm/api/marca";
const DI_BASE = "CRM";

const leggiMarca = async (): Promise<string> => {
  const risposta = await fetch(MARCA_URL, { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!risposta.ok) throw new Error(`/crm/api/marca ha risposto ${risposta.status}`);
  const { nome } = (await risposta.json()) as { nome?: unknown };
  return typeof nome === "string" && nome.trim() ? nome.trim() : DI_BASE;
};

export const useMarca = () => {
  const { data } = useQuery({
    queryKey: ["crm", "marca"],
    queryFn: leggiMarca,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const nome = data ?? DI_BASE;
  return { nome, iniziale: Array.from(nome)[0].toUpperCase() };
};
