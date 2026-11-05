import { useMemo } from "react";
import { CreateButton } from "@/components/admin/create-button";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { Euro, GiornoOra, Quando, Numero, Sito, Socio, DaDove, StatoCella, TagCella, Testo, TestoIntero, UltimaAttivita, VersoScheda, Vuoto } from "@/crm/colonne/celle";
import { ScegliColonne } from "@/crm/colonne/ScegliColonne";
import { campoPersona, celleTrattativa, nomeRiga, tagRiga, testoRiga, valoreRiga, vivaDalloStato } from "@/crm/colonne/modifiche";
import { CellaSegue, destinoDaStato } from "@/crm/colonne/segue";
import { TabellaColonne } from "@/crm/colonne/TabellaColonne";
import { useCampiColonne } from "@/crm/colonne/useCampiColonne";
import { useColonne, type Colonna } from "@/crm/colonne/useColonne";
import { LinkEmail, LinkTelefono } from "@/crm/persone/link";
import { pathAzienda, pathPersona } from "@/crm/persone/campi";
import { useSoci } from "@/crm/soci";
import { FiltroTag } from "@/crm/tag";
import { FornitoreAggregati, type Azienda } from "./aggregati";
import { CellaNome } from "./celle";
import { FiltroNonAziende } from "./FiltroNonAziende";

const filtri = [
  <SearchInput key="q" source="q" alwaysOn className="w-[280px]" />,
  <FiltroTag key="tag" source="tag" oggetto="azienda" alwaysOn />,
  <FiltroNonAziende key="etichetta" source="etichetta" alwaysOn />,
];

const PERSONE_VISTE = 2;

const Persone = ({ r }: { r: Azienda }) => {
  const elenco = r.persone ?? [];
  if (!elenco.length) return <Vuoto />;
  const resto = (r.persone_totali ?? elenco.length) - Math.min(elenco.length, PERSONE_VISTE);
  return (
    <>
      {elenco.slice(0, PERSONE_VISTE).map((p, i) => (
        <span key={p.id}>
          {i ? ", " : ""}
          <VersoScheda to={pathPersona(p.id)}>{p.nome}</VersoScheda>
        </span>
      ))}
      {resto > 0 ? <span className="pl-1 text-xs text-mute">+{resto}</span> : null}
    </>
  );
};

const Trattative = ({ r }: { r: Azienda }) => {
  const totali = r.trattative_totali ?? 0;
  if (!totali) return <Vuoto />;
  const verso = totali === 1 && r.stato?.trattativa_id ? `/trattative/${r.stato.trattativa_id}` : pathAzienda(r.id);
  return (
    <span className="tabular-nums">
      <VersoScheda to={verso}>
        {r.trattative_aperte ?? 0} su {totali}
      </VersoScheda>
    </span>
  );
};

const altrePersone = (r: Azienda) => ({ totali: r.persone_totali, nome: r.persona_nome });
const dellaTrattativa = celleTrattativa<Azienda>(
  (r) => {
    const t = vivaDalloStato(r.stato);
    return t && { ...t, avvio: r.trattativa_avvio, canone: r.trattativa_canone, valore: r.trattativa_valore };
  },
  { passo: "trattativa_passo", il: "trattativa_il" },
);
const testoAzienda = (colonna: string) => testoRiga<Azienda>("aziende", colonna);
const RICHIAMARE = { tipo: "istante" as const, opzioni: [], svuotabile: true };

const colonneAziende = (nomeDi: (email?: string | null) => string): Colonna<Azienda>[] => [
  { id: "nome", etichetta: "Nome", ordina: "nome", largo: "max-w-[200px] sm:max-w-[300px]", modifica: nomeRiga<Azienda>("aziende"), cella: () => <CellaNome /> },
  { id: "stato", etichetta: "Stato", cella: (r) => <StatoCella stato={r.stato} /> },
  { id: "persone", etichetta: "Persone", largo: "max-w-[260px]", cella: (r) => <Persone r={r} /> },
  { id: "trattative", etichetta: "Trattative", cella: (r) => <Trattative r={r} /> },
  { id: "segue", etichetta: "Segue", cella: (r) => <CellaSegue valore={r.calcolati?.segue} destino={destinoDaStato(r.stato, r.id)} /> },
  { id: "da_dove", etichetta: "Da dove", largo: "max-w-[320px]", cella: (r) => <DaDove d={r.da_dove} /> },
  { id: "ultima", etichetta: "Ultima attività", largo: "max-w-[280px]", cella: (r) => <UltimaAttivita u={r.ultima} nomeDi={nomeDi} /> },
  { id: "telefono", etichetta: "Telefono", ordina: "telefono", modifica: testoAzienda("telefono"), cella: (r) => <LinkTelefono valore={r.telefono} /> },
  { id: "email", etichetta: "Email", ordina: "email", largo: "max-w-[240px]", modifica: testoAzienda("email"), cella: (r) => <LinkEmail valore={r.email} /> },
  { id: "sito", etichetta: "Sito", ordina: "sito", largo: "max-w-[220px]", modifica: testoAzienda("sito"), cella: (r) => <Sito v={r.sito} /> },
  { id: "comune", etichetta: "Comune", ordina: "comune", largo: "max-w-[180px]", modifica: testoAzienda("comune"), cella: (r) => <Testo v={r.comune} /> },
  { id: "categoria", etichetta: "Categoria", ordina: "categoria", largo: "max-w-[200px]", modifica: testoAzienda("categoria"), cella: (r) => <Testo v={r.categoria} /> },
  { id: "indirizzo", etichetta: "Indirizzo", ordina: "indirizzo", largo: "max-w-[260px]", modifica: testoAzienda("indirizzo"), cella: (r) => <Testo v={r.indirizzo} /> },
  { id: "piva", etichetta: "P.IVA", ordina: "piva", modifica: testoAzienda("piva"), cella: (r) => <Testo v={r.piva} /> },
  { id: "valutazione", etichetta: "Valutazione", ordina: "valutazione", cella: (r) => <Numero v={r.valutazione} /> },
  { id: "recensioni", etichetta: "Recensioni", ordina: "recensioni", cella: (r) => <Numero v={r.recensioni} /> },
  { id: "tentativi", etichetta: "Tentativi", ordina: "tentativi", cella: (r) => <Numero v={r.calcolati?.tentativi} zeroVuoto /> },
  { id: "ultima_chiamata", etichetta: "Ultima chiamata", ordina: "ultima_chiamata", cella: (r) => <Quando v={r.calcolati?.ultima_chiamata} /> },
  {
    id: "richiamare_il",
    etichetta: "Richiamare il",
    ordina: "richiamare_il",
    modifica: (r) =>
      r.trattative_totali
        ? { soloLettura: "Con una trattativa si calcola da lei: si cambia dalla trattativa" }
        : valoreRiga<Azienda>("aziende", "richiamare_il", RICHIAMARE, (x) => x.calcolati?.richiamare_il, (x, v) => ({ ...x, calcolati: { ...x.calcolati, richiamare_il: v as string | null } }))(r),
    cella: (r) => <GiornoOra v={r.calcolati?.richiamare_il} />,
  },
  { id: "chiamato_da", etichetta: "Chiamato da", ordina: "chiamato_da", cella: (r) => <Socio v={nomeDi(r.calcolati?.chiamato_da)} /> },
  { id: "tag", etichetta: "Tag", modifica: tagRiga<Azienda>("azienda"), cella: (r) => <TagCella tag={r.tag} /> },
  { id: "referente", etichetta: "Referente", ordina: "referente", largo: "max-w-[200px]", modifica: testoAzienda("referente"), cella: (r) => <Testo v={r.referente} /> },
  { id: "note", etichetta: "Note sull'azienda", largo: "max-w-[260px]", modifica: testoRiga<Azienda>("aziende", "note", { editore: { tipo: "testo", opzioni: [], svuotabile: true, lungo: true } }), cella: (r) => <TestoIntero v={r.note} /> },
  { id: "ultima_nota", etichetta: "Ultima nota", largo: "max-w-[260px]", cella: (r) => <TestoIntero v={r.ultima_nota} /> },
  { id: "categorie", etichetta: "Categorie", largo: "max-w-[260px]", cella: (r) => <Testo v={(r.categorie ?? []).join(", ")} /> },
  { id: "dominio", etichetta: "Dominio", ordina: "dominio", largo: "max-w-[220px]", cella: (r) => <Testo v={r.dominio} /> },
  { id: "creato", etichetta: "Creata", ordina: "creato", cella: (r) => <Quando v={r.creato} /> },
  { id: "creato_da", etichetta: "Creata da", ordina: "creato_da", cella: (r) => <Socio v={nomeDi(r.creato_da)} /> },
  { id: "aggiornato", etichetta: "Aggiornata", ordina: "aggiornato", cella: (r) => <Quando v={r.aggiornato} /> },
  { id: "persona_ruolo", etichetta: "Posizione", largo: "max-w-[200px]", modifica: campoPersona<Azienda>("persona_ruolo", "ruolo", altrePersone), cella: (r) => <Testo v={r.persona_ruolo} /> },
  { id: "persona_telefono", etichetta: "Telefono persona", modifica: campoPersona<Azienda>("persona_telefono", "telefono", altrePersone), cella: (r) => <LinkTelefono valore={r.persona_telefono} /> },
  { id: "persona_email", etichetta: "Email persona", largo: "max-w-[240px]", modifica: campoPersona<Azienda>("persona_email", "email", altrePersone), cella: (r) => <LinkEmail valore={r.persona_email} /> },
  { id: "trattativa_valore", etichetta: "Valore", modifica: dellaTrattativa.valore, cella: (r) => <Euro v={r.trattativa_valore} /> },
  { id: "trattativa_passo", etichetta: "Prossimo passo", largo: "max-w-[260px]", modifica: dellaTrattativa.passo, cella: (r) => <Testo v={r.trattativa_passo} /> },
  { id: "trattativa_il", etichetta: "Prossimo il", modifica: dellaTrattativa.il, cella: (r) => <GiornoOra v={r.trattativa_il} /> },
  { id: "etichetta", etichetta: "Etichetta", cella: (r) => <Testo v={r.dati?.etichetta} /> },
];

export const AziendeLista = () => {
  const { nomeDi } = useSoci();
  const campi = useCampiColonne<Azienda>("azienda");
  const tutte = useMemo(() => [...colonneAziende(nomeDi), ...campi], [nomeDi, campi]);
  const colonne = useColonne("aziende", tutte);
  return (
    <List
      filters={filtri}
      perPage={25}
      sort={{ field: "nome", order: "ASC" }}
      actions={
        <>
          <ScegliColonne stato={colonne} />
          <CreateButton />
        </>
      }
    >
      <FornitoreAggregati>
        <TabellaColonne<Azienda> stato={colonne} />
      </FornitoreAggregati>
    </List>
  );
};
