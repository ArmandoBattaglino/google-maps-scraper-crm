import { useParams } from "react-router";
import { useGetOne } from "ra-core";
import { Testata } from "@/layout/Testata";
import type { Soggetto } from "./campi";
import { Timeline } from "./Timeline";

const COLONNE: Record<string, { soggetto: (id: string) => Soggetto; nome: string }> = {
  aziende: { soggetto: (id) => ({ azienda_id: id }), nome: "Azienda" },
  persone: { soggetto: (id) => ({ persona_id: id }), nome: "Persona" },
  trattative: { soggetto: (id) => ({ trattativa_id: id }), nome: "Trattativa" },
};

export const PaginaCronologia = () => {
  const { risorsa = "", id = "" } = useParams();
  const c = COLONNE[risorsa];
  const { data } = useGetOne<{ id: string; nome?: string }>(risorsa, { id }, { enabled: Boolean(c) });
  if (!c) return <Testata titolo="Questa cronologia non esiste" />;
  return (
    <div data-pagina="cronologia" className="pb-12">
      <Testata titolo={data?.nome || c.nome} />
      <div className="max-w-[820px] px-6">
        <Timeline {...c.soggetto(id)} />
      </div>
    </div>
  );
};
