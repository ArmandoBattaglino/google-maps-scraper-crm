import { useMemo } from "react";
import { CreateButton } from "@/components/admin/create-button";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { DaDove, Euro, GiornoOra, Quando, Sito, Socio, StatoCella, TagCella, Testo, TestoIntero, UltimaAttivita, VersoScheda, Vuoto, type Stato, type TagRiga, type Ultima } from "@/crm/colonne/celle";
import type { DatiDaDove } from "@/crm/colonne/daDove";
import { ScegliColonne } from "@/crm/colonne/ScegliColonne";
import { campoAzienda, celleTrattativa, legameRiga, nomeRiga, tagRiga, testoRiga } from "@/crm/colonne/modifiche";
import { CellaSegue, destinoDaStato } from "@/crm/colonne/segue";
import { TabellaColonne } from "@/crm/colonne/TabellaColonne";
import { useCampiColonne } from "@/crm/colonne/useCampiColonne";
import { useColonne, type Colonna } from "@/crm/colonne/useColonne";
import { useSoci } from "@/crm/soci";
import { FiltroTag } from "@/crm/tag";
import { LogoAzienda } from "@/components/crm/forme";
import { NON_ARCHIVIATE, pathAzienda, type Persona } from "./campi";
import { CellaEmail, CellaNome, CellaTelefono } from "./celle";

const filtri = [
  <SearchInput key="q" source="q" alwaysOn className="w-[280px]" />,
  <FiltroTag key="tag" source="tag" oggetto="persona" alwaysOn />,
];

export interface RigaPersona extends Persona {
  azienda_telefono?: string | null;
  azienda_sito?: string | null;
  azienda_comune?: string | null;
  azienda_categoria?: string | null;
  trattativa_id?: string | null;
  trattativa_tipo?: string | null;
  trattativa_avvio?: string | number | null;
  trattativa_canone?: string | number | null;
  trattativa_passo?: string | null;
  trattativa_il?: string | null;
  azienda_nome?: string | null;
  segue?: string | null;
  stato?: Stato | null;
  valore?: string | number | null;
  percorso_nome?: string | null;
  trattative_totali?: number;
  da_dove?: DatiDaDove | null;
  ultima?: Ultima | null;
  ultima_nota?: string | null;
  tag?: TagRiga[];
  campi?: Record<string, unknown> | null;
}

const Azienda = ({ r }: { r: RigaPersona }) => {
  if (!r.azienda_id) return <Vuoto />;
  const nome = r.azienda_nome ?? "";
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <LogoAzienda nome={nome} />
      <span className="min-w-0 truncate">
        <VersoScheda to={pathAzienda(r.azienda_id)}>{nome}</VersoScheda>
      </span>
    </span>
  );
};

const Trattativa = ({ r }: { r: RigaPersona }) => {
  if (!r.trattative_totali || !r.stato?.trattativa_id) return <Vuoto />;
  const resto = (r.trattative_totali ?? 1) - 1;
  return (
    <>
      <VersoScheda to={`/trattative/${r.stato.trattativa_id}`}>{r.percorso_nome ?? "Apri"}</VersoScheda>
      {resto > 0 ? <span className="pl-1 text-xs text-mute">+{resto}</span> : null}
    </>
  );
};

const dellaTrattativa = celleTrattativa<RigaPersona>(
  (r) => (r.trattativa_id ? { id: r.trattativa_id, tipo: r.trattativa_tipo, altre: r.stato?.altre_aperte, avvio: r.trattativa_avvio, canone: r.trattativa_canone, valore: r.valore } : null),
  { passo: "trattativa_passo", il: "trattativa_il" },
);
const testoPersona = (colonna: string) => testoRiga<RigaPersona>("persone", colonna);

const colonnePersone = (nomeDi: (email?: string | null) => string): Colonna<RigaPersona>[] => [
  { id: "nome", etichetta: "Nome", ordina: "nome", largo: "max-w-[200px] sm:max-w-[260px]", modifica: nomeRiga<RigaPersona>("persone"), cella: () => <CellaNome /> },
  { id: "azienda", etichetta: "Azienda", largo: "max-w-[260px]", modifica: legameRiga<RigaPersona>("persone", "aziende", "azienda_id", (r) => r.azienda_nome), cella: (r) => <Azienda r={r} /> },
  { id: "ruolo", etichetta: "Posizione", ordina: "ruolo", largo: "max-w-[200px]", modifica: testoPersona("ruolo"), cella: (r) => <Testo v={r.ruolo} /> },
  { id: "stato", etichetta: "Stato", cella: (r) => <StatoCella stato={r.stato} /> },
  { id: "trattativa", etichetta: "Trattativa", largo: "max-w-[200px]", cella: (r) => <Trattativa r={r} /> },
  { id: "telefono", etichetta: "Telefono", ordina: "telefono", modifica: testoPersona("telefono"), cella: () => <CellaTelefono /> },
  { id: "email", etichetta: "Email", ordina: "email", largo: "max-w-[240px]", modifica: testoPersona("email"), cella: () => <CellaEmail /> },
  { id: "segue", etichetta: "Segue", cella: (r) => <CellaSegue valore={r.segue} destino={destinoDaStato(r.stato, r.azienda_id)} /> },
  { id: "da_dove", etichetta: "Da dove", largo: "max-w-[320px]", cella: (r) => <DaDove d={r.da_dove} /> },
  { id: "ultima", etichetta: "Ultima attività", largo: "max-w-[280px]", cella: (r) => <UltimaAttivita u={r.ultima} nomeDi={nomeDi} /> },
  { id: "ultima_nota", etichetta: "Ultima nota", largo: "max-w-[260px]", cella: (r) => <TestoIntero v={r.ultima_nota} /> },
  { id: "valore", etichetta: "Valore", modifica: dellaTrattativa.valore, cella: (r) => <Euro v={r.valore} /> },
  { id: "tag", etichetta: "Tag", modifica: tagRiga<RigaPersona>("persona"), cella: (r) => <TagCella tag={r.tag} /> },
  { id: "creato", etichetta: "Creata", ordina: "creato", cella: (r) => <Quando v={r.creato} /> },
  { id: "creato_da", etichetta: "Creata da", ordina: "creato_da", cella: (r) => <Socio v={nomeDi(r.creato_da)} /> },
  { id: "aggiornato", etichetta: "Aggiornata", ordina: "aggiornato", cella: (r) => <Quando v={r.aggiornato} /> },
  { id: "fonte", etichetta: "Fonte", ordina: "fonte", largo: "max-w-[200px]", modifica: testoPersona("fonte"), cella: (r) => <Testo v={r.fonte} /> },
  { id: "azienda_telefono", etichetta: "Telefono azienda", modifica: campoAzienda<RigaPersona>("azienda_telefono", "telefono"), cella: (r) => <Testo v={r.azienda_telefono} /> },
  { id: "azienda_sito", etichetta: "Sito azienda", largo: "max-w-[220px]", modifica: campoAzienda<RigaPersona>("azienda_sito", "sito"), cella: (r) => <Sito v={r.azienda_sito} /> },
  { id: "azienda_comune", etichetta: "Comune", largo: "max-w-[180px]", modifica: campoAzienda<RigaPersona>("azienda_comune", "comune"), cella: (r) => <Testo v={r.azienda_comune} /> },
  { id: "azienda_categoria", etichetta: "Categoria", largo: "max-w-[200px]", modifica: campoAzienda<RigaPersona>("azienda_categoria", "categoria"), cella: (r) => <Testo v={r.azienda_categoria} /> },
  { id: "trattativa_passo", etichetta: "Prossimo passo", largo: "max-w-[260px]", modifica: dellaTrattativa.passo, cella: (r) => <Testo v={r.trattativa_passo} /> },
  { id: "trattativa_il", etichetta: "Prossimo il", modifica: dellaTrattativa.il, cella: (r) => <GiornoOra v={r.trattativa_il} /> },
];

const CON_LEGAMI = { meta: { elenco: true } };

export const PersoneLista = () => {
  const { nomeDi } = useSoci();
  const campi = useCampiColonne<RigaPersona>("persona");
  const tutte = useMemo(() => [...colonnePersone(nomeDi), ...campi], [nomeDi, campi]);
  const colonne = useColonne("persone", tutte);
  return (
    <List
      filters={filtri}
      filter={NON_ARCHIVIATE}
      perPage={25}
      sort={{ field: "nome", order: "ASC" }}
      queryOptions={CON_LEGAMI}
      actions={
        <>
          <ScegliColonne stato={colonne} />
          <CreateButton />
        </>
      }
    >
      <TabellaColonne<RigaPersona> stato={colonne} />
    </List>
  );
};
