import { useRecordContext } from "ra-core";
import { Chip, LogoAzienda, type TonoChip } from "@/components/crm/forme";
import { useAggregati, type Azienda } from "./aggregati";
import { ESITI } from "./campi";

const Assente = () => <span className="text-assente">—</span>;

export const BadgeCrm = ({ contatto, tipo }: { contatto?: string | null; tipo?: string }) => {
  if (!contatto || tipo !== "cliente") return null;
  return <Chip tono="pieno">Cliente</Chip>;
};

export const CellaNome = () => {
  const r = useRecordContext<Azienda>();
  const { tipoContatto } = useAggregati();
  if (!r) return null;
  const nome = r.nome ?? "";
  return (
    <span className="flex items-center gap-[9px] font-medium text-ink">
      <LogoAzienda nome={nome} />
      <span className="min-w-0 truncate">{nome}</span>
      <BadgeCrm contatto={r.contatto_id} tipo={tipoContatto(r.contatto_id)} />
    </span>
  );
};

const TONI: Record<string, TonoChip> = {
  "da-chiamare": "vuoto",
  "non-risponde": "neutro",
  richiamare: "ambra",
  "non-interessato": "rosso",
  interessato: "verde",
};

export const tonoDellEsito = (parole: string): TonoChip => TONI[ESITI.find((e) => e.name === parole)?.id ?? ""] ?? "neutro";

export const EtichettaEsito = ({ esito }: { esito?: string | null }) => {
  if (!esito) return <Assente />;
  const nome = ESITI.find((e) => e.id === esito)?.name ?? esito;
  return <Chip tono={TONI[esito] ?? "neutro"}>{nome}</Chip>;
};
