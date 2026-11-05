import type { ReactNode } from "react";
import { LinkBase, useGetMany } from "ra-core";
import { Building2, Target } from "lucide-react";
import { GruppoLegami, LogoAzienda, PallinoFase, type Fase } from "@/components/crm/forme";
import { pathAzienda } from "./campi";

export interface Trattativa {
  id: string;
  fase_id: string;
  prossimo_passo: string;
  valore: string | number | null;
  contatto_id: string | null;
  archiviata_il: string | null;
}

export interface AziendaLegata {
  id: string;
  nome: string;
  comune?: string;
}

interface FaseLead {
  id: string;
  nome: string;
  tipo: string;
}

const PALLINI: Record<string, Fase> = { aperta: "consulenza", cliente: "firmato", perso: "perso" };

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const Riga = ({
  to,
  segno,
  titolo,
  sotto,
  destra,
}: {
  to: string;
  segno: ReactNode;
  titolo: string;
  sotto?: string;
  destra?: string;
}) => (
  <LinkBase to={to} className="flex items-center gap-2.5 rounded-md px-2 py-[7px] text-ink hover:bg-hover">
    {segno}
    <span className="min-w-0">
      <span className="block truncate">{titolo}</span>
      {sotto ? <small className="block truncate text-xs text-mute">{sotto}</small> : null}
    </span>
    {destra ? <span className="ml-auto text-xs whitespace-nowrap text-ink2 tabular-nums">{destra}</span> : null}
  </LinkBase>
);

export const Legami = ({ azienda, trattative }: { azienda?: AziendaLegata; trattative: Trattativa[] }) => {
  const { data: fasi } = useGetMany<FaseLead>(
    "fasi",
    { ids: [...new Set(trattative.map((t) => t.fase_id))] },
    { enabled: trattative.length > 0 },
  );
  return (
    <>
      <GruppoLegami icona={<Target />} titolo="Trattative">
        {trattative.map((t) => {
          const fase = fasi?.find((f) => f.id === t.fase_id);
          const valore = Number(t.valore);
          return (
            <Riga
              key={t.id}
              to={`/trattative/${t.id}`}
              segno={<PallinoFase fase={PALLINI[fase?.tipo ?? "aperta"] ?? "consulenza"} />}
              titolo={fase?.nome ?? t.fase_id}
              sotto={t.archiviata_il ? "archiviata" : t.prossimo_passo || undefined}
              destra={valore > 0 ? euro.format(valore) : undefined}
            />
          );
        })}
      </GruppoLegami>
      <GruppoLegami icona={<Building2 />} titolo="Azienda">
        {azienda
          ? [
              <Riga
                key={azienda.id}
                to={pathAzienda(azienda.id)}
                segno={<LogoAzienda nome={azienda.nome} />}
                titolo={azienda.nome}
                sotto={azienda.comune || undefined}
              />,
            ]
          : []}
      </GruppoLegami>
    </>
  );
};
