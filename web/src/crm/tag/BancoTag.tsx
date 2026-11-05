import { useState } from "react";
import { LinkBase, useRecordContext } from "ra-core";
import { useParams } from "react-router";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { inOrdine, PRIMA_ENTITA, type Entita } from "@/crm/entita";
import { cn } from "@/lib/utils";
import type { OggettoTag } from "./dati";
import { FiltroTag } from "./FiltroTag";
import { SezioneTag, TagOggetto } from "./TagOggetto";

const OGGETTI: Record<string, { oggetto: OggettoTag; etichetta: string; campo: string }> = {
  aziende: { oggetto: "azienda", etichetta: "Aziende", campo: "nome" },
  persone: { oggetto: "persona", etichetta: "Persone", campo: "nome" },
  trattative: { oggetto: "trattativa", etichetta: "Trattative", campo: "prossimo_passo" },
};

const CellaTag = ({ oggetto }: { oggetto: OggettoTag }) => {
  const r = useRecordContext<{ id: string }>();
  return r ? <TagOggetto oggetto={oggetto} oggettoId={r.id} /> : null;
};

export const BancoTag = () => {
  const { risorsa = PRIMA_ENTITA } = useParams();
  const chiave = risorsa in OGGETTI ? risorsa : PRIMA_ENTITA;
  const dove = OGGETTI[chiave];
  const [scelta, setScelta] = useState<string | null>(null);
  const filtri = [
    <SearchInput key="q" source="q" alwaysOn className="w-[280px]" />,
    <FiltroTag key="tag" source="tag" oggetto={dove.oggetto} alwaysOn />,
  ];

  return (
    <div data-pagina="tag" className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 border-r border-line">
        <nav aria-label="Oggetti" className="flex gap-1 px-6 pt-3">
          {inOrdine(Object.entries(OGGETTI), ([k]) => k as Entita).map(([k, o]) => (
            <LinkBase
              key={k}
              to={`/tag/${k}`}
              aria-current={k === chiave ? "page" : undefined}
              onClick={() => setScelta(null)}
              className={cn("rounded-md px-2.5 py-1 text-ink2 hover:bg-hover", k === chiave && "bg-hover font-medium text-ink")}
            >
              {o.etichetta}
            </LinkBase>
          ))}
        </nav>
        <List
          key={chiave}
          resource={chiave}
          storeKey={`banco-tag.${chiave}`}
          title={`Tag delle ${dove.etichetta.toLowerCase()}`}
          filters={filtri}
          actions={<></>}
          disableBreadcrumb
          perPage={25}
          sort={{ field: dove.campo, order: "ASC" }}
        >
          <DataTable
            bulkActionButtons={false}
            rowClick={(id) => {
              setScelta(String(id));
              return false;
            }}
          >
            <DataTable.Col source={dove.campo} />
            <DataTable.Col label="Tag" disableSort>
              <CellaTag oggetto={dove.oggetto} />
            </DataTable.Col>
          </DataTable>
        </List>
      </div>
      <aside className="bg-rec-side p-5">
        {scelta ? (
          <SezioneTag oggetto={dove.oggetto} oggettoId={scelta} />
        ) : (
          <p className="text-mute">Scegli una riga per vedere i suoi tag come in una scheda.</p>
        )}
      </aside>
    </div>
  );
};
