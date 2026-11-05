import { useState } from "react";
import { useListContext, useResourceContext, type RaRecord } from "ra-core";
import { useNavigate } from "react-router";
import { DataTableEmpty } from "@/components/admin/data-table";
import { useAzioniRiga, type RisorsaAzioni } from "@/crm/azioni/MenuRiga";
import { TabellaCrm, type Propria } from "./TabellaCrm";
import type { StatoColonne } from "./useColonne";

const PROPRIA: Record<string, Propria> = { aziende: "Azienda", persone: "Persona" };

const SCORRE = "max-h-[calc(100svh-218px)] min-h-[240px]";

export const TabellaColonne = <R extends RaRecord>({ stato }: { stato: StatoColonne<R> }) => {
  const risorsa = useResourceContext() as RisorsaAzioni;
  const { data, isPending, sort, setSort, filterValues, page, perPage } = useListContext<R>();
  const azioni = useAzioniRiga(risorsa);
  const navigate = useNavigate();
  const chiaveRighe = JSON.stringify([sort, filterValues, page, perPage]);
  const [scrittaSu, setScrittaSu] = useState<string | null>(null);

  if (isPending) return <p className="animate-pulse px-2 py-4 tracking-[0.2em] text-mute" role="status">...</p>;
  if (!data?.length && scrittaSu !== chiaveRighe) return <DataTableEmpty />;
  return (
    <>
      {azioni.nodo}
      <TabellaCrm<R>
        stato={stato}
        propria={PROPRIA[risorsa] ?? "Azienda"}
        righe={data ?? []}
        ordine={sort?.field ? { campo: sort.field, dir: sort.order === "DESC" ? "desc" : "asc" } : null}
        onOrdina={(o) => setSort({ field: o.campo, order: o.dir === "desc" ? "DESC" : "ASC" })}
        onRiga={(r) => navigate(`/${risorsa}/${String(r.id)}`)}
        perMenu={(r) => ({
          id: String(r.id),
          nome: String((r as { nome?: unknown }).nome ?? ""),
          archiviata_il: (r as { archiviata_il?: unknown }).archiviata_il,
        })}
        onMenu={azioni.apri}
        className={SCORRE}
        chiaveRighe={chiaveRighe}
        onScrittura={() => setScrittaSu(chiaveRighe)}
      />
    </>
  );
};
