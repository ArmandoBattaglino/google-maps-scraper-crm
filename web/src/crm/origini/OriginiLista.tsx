import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Rows3 } from "lucide-react";
import { useInput, useListContext } from "ra-core";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { DataTableEmpty } from "@/components/admin/data-table";
import { Chip } from "@/components/crm/forme";
import { Button } from "@/components/ui/button";
import { chiedi } from "@/crm/chiama/api";
import { Numero, Quando, StatoCella, Testo, VersoScheda, Vuoto } from "@/crm/colonne/celle";
import { ScegliColonne } from "@/crm/colonne/ScegliColonne";
import { TabellaCrm, type Sezione } from "@/crm/colonne/TabellaCrm";
import { useColonne, type Colonna, type StatoColonne } from "@/crm/colonne/useColonne";
import { Scelta } from "@/crm/Scelta";
import { Segmenti } from "@/crm/Segmenti";
import { pathAzienda, pathPersona } from "@/crm/persone/campi";
import { PannelloOrigine } from "./Pannello";
import { VOCI, nomeVoce, type RigaOrigine } from "./voci";

const SCORRE = "max-h-[calc(100svh-218px)] min-h-[240px]";

const FiltroTipo = ({ source = "tipo" }: { source?: string; alwaysOn?: boolean }) => {
  const { field } = useInput({ source });
  return (
    <div className="mt-auto flex min-h-[30px] items-center">
      <Segmenti
        etichetta="Quali arrivi"
        valore={field.value === "origini" ? "origini" : "tutti"}
        opzioni={[
          { valore: "tutti", etichetta: "Anche ritorni" },
          { valore: "origini", etichetta: "Solo origini" },
        ]}
        onScegli={(v) => field.onChange(v === "origini" ? "origini" : "")}
      />
    </div>
  );
};

const FiltroCanale = ({ source = "voce" }: { source?: string; alwaysOn?: boolean }) => {
  const { field } = useInput({ source });
  return (
    <div className="mt-auto flex min-h-[30px] items-center">
      <Scelta
        etichetta="Canale"
        valore={field.value || "tutti"}
        className="w-[190px]"
        opzioni={[{ valore: "tutti", etichetta: "Tutti i canali" }, ...VOCI]}
        onScegli={(v) => field.onChange(v === "tutti" ? "" : v)}
      />
    </div>
  );
};

const RaggruppaCanale = ({ source = "gruppo" }: { source?: string; alwaysOn?: boolean }) => {
  const { field } = useInput({ source });
  const attivo = field.value === "voce";
  return (
    <div className="mt-auto flex min-h-[30px] items-center">
      <Button type="button" variant={attivo ? "secondary" : "outline"} aria-pressed={attivo} data-raggruppa-canale onClick={() => field.onChange(attivo ? "" : "voce")}>
        <Rows3 />
        Raggruppa per canale
      </Button>
    </div>
  );
};

const filtri = [
  <SearchInput key="q" source="q" alwaysOn className="w-[260px]" />,
  <FiltroTipo key="tipo" source="tipo" alwaysOn />,
  <FiltroCanale key="voce" source="voce" alwaysOn />,
  <RaggruppaCanale key="gruppo" source="gruppo" alwaysOn />,
];

const COLONNE: Colonna<RigaOrigine>[] = [
  {
    id: "azienda",
    etichetta: "Azienda",
    largo: "max-w-[220px]",
    cella: (r) => (
      <span className="font-medium">
        <VersoScheda to={pathAzienda(r.azienda_id)}>{r.azienda_nome}</VersoScheda>
      </span>
    ),
  },
  { id: "persona", etichetta: "Persona", largo: "max-w-[180px]", cella: (r) => (r.persona_id ? <VersoScheda to={pathPersona(r.persona_id)}>{r.persona_nome}</VersoScheda> : <Vuoto />) },
  {
    id: "trattativa",
    etichetta: "Trattativa",
    cella: (r) =>
      r.trattativa_id ? (
        <VersoScheda to={`/trattative/${r.trattativa_id}`}>
          <StatoCella stato={{ fase: r.fase_nome ?? r.fase_id ?? "", tipo: r.fase_tipo, trattativa_id: r.trattativa_id, archiviata: !!r.trattativa_archiviata }} />
        </VersoScheda>
      ) : (
        <Vuoto />
      ),
  },
  { id: "tipo", etichetta: "Tipo", cella: (r) => (r.prima ? <Chip tono="blu">Origine</Chip> : <Chip>Ritorno</Chip>) },
  { id: "canale", etichetta: "Canale", cella: (r) => <Testo v={nomeVoce(r.voce)} /> },
  { id: "quando", etichetta: "Quando", cella: (r) => <Quando v={r.quando} /> },
  { id: "parola", etichetta: "Parola", largo: "max-w-[180px]", cella: (r) => <Testo v={r.parola || r.da_chi} /> },
  { id: "zona", etichetta: "Zona", largo: "max-w-[180px]", cella: (r) => <Testo v={r.zona || r.luogo} /> },
  { id: "metodo", etichetta: "Metodo", cella: (r) => <Testo v={r.metodo} /> },
  { id: "volte", etichetta: "Volte", cella: (r) => <Numero v={r.volte} /> },
];

const Tabella = ({ stato, apri }: { stato: StatoColonne<RigaOrigine>; apri: (id: string) => void }) => {
  const { data, isPending, sort, setSort, filterValues } = useListContext<RigaOrigine>();
  const gruppi = filterValues.gruppo === "voce";
  const q = new URLSearchParams();
  for (const k of ["tipo", "q"]) if (filterValues[k]) q.set(k, String(filterValues[k]));
  const { data: conti } = useQuery({
    queryKey: ["origini", "conteggi", q.toString()],
    enabled: gruppi,
    queryFn: () => chiedi<{ totale: number; voci: Record<string, number> }>(`/origini/conteggi?${q.toString()}`),
  });
  if (isPending) return <p className="animate-pulse px-2 py-4 tracking-[0.2em] text-mute" role="status">...</p>;
  if (!data?.length) return <DataTableEmpty />;
  const perVoce = new Map<string, Sezione<RigaOrigine>>();
  if (gruppi) {
    for (const r of data) {
      const s = perVoce.get(r.voce);
      if (s) s.righe.push(r);
      else perVoce.set(r.voce, { chiave: r.voce, titolo: nomeVoce(r.voce), numero: conti?.voci[r.voce] ?? "", righe: [r] });
    }
  }
  return (
    <TabellaCrm<RigaOrigine>
      stato={stato}
      propria="Azienda"
      senzaEntita
      righe={data}
      sezioni={gruppi ? [...perVoce.values()] : undefined}
      ordine={sort?.field ? { campo: sort.field, dir: sort.order === "DESC" ? "desc" : "asc" } : null}
      onOrdina={(o) => setSort({ field: o.campo, order: o.dir === "desc" ? "DESC" : "ASC" })}
      onRiga={(r) => apri(r.id)}
      perMenu={(r) => ({ id: r.id, nome: r.azienda_nome })}
      onMenu={null}
      className={SCORRE}
    />
  );
};

export const OriginiLista = () => {
  const [aperto, setAperto] = useState<string | null>(null);
  const colonne = useColonne("origini", COLONNE);
  return (
    <>
      <List filters={filtri} perPage={25} sort={{ field: "arrivi", order: "DESC" }} title="Origini" actions={<ScegliColonne stato={colonne} />}>
        <Tabella stato={colonne} apri={setAperto} />
      </List>
      {aperto ? <PannelloOrigine id={aperto} onChiudi={() => setAperto(null)} /> : null}
    </>
  );
};
