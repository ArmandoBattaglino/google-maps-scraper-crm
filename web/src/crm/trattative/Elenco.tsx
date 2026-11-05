import { useMemo, useContext } from "react";
import { AzioniRiga } from "@/crm/azioni/MenuRiga";
import { TabellaCrm, type Ordine } from "@/crm/colonne/TabellaCrm";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { useNavigate } from "react-router";
import { campoAzienda, campoPersona, legameRiga, OBBLIGATORIO_PASSO, tagRiga, testoRiga, valoreRiga } from "@/crm/colonne/modifiche";
import { CellaSegue } from "@/crm/colonne/segue";
import { DaDove, Euro, GiornoOra, Quando, Sito, Socio, StatoCella, TagCella, Testo, TestoIntero, UltimaAttivita, VersoScheda, Vuoto, type TagRiga, type Ultima } from "@/crm/colonne/celle";
import type { DatiDaDove } from "@/crm/colonne/daDove";
import type { Colonna, StatoColonne } from "@/crm/colonne/useColonne";
import { pathAzienda, pathPersona } from "@/crm/persone/campi";
import { LinkEmail, LinkTelefono } from "@/crm/persone/link";
import { Fermo, giorniFerma, quandoMossa } from "./Fermo";
import { MOTIVI_PERSO, SEMPRE_APERTE, TEMPERATURE, type FaseRiga, type Percorso, type Trattativa } from "./tipi";
import { faseDiPartenza } from "./useSposta";

export interface RigaElenco extends Trattativa {
  creato_da?: string | null;
  aggiornato?: string | null;
  azienda_telefono?: string | null;
  azienda_sito?: string | null;
  azienda_comune?: string | null;
  azienda_categoria?: string | null;
  persona_ruolo?: string | null;
  persona_telefono?: string | null;
  persona_email?: string | null;
  azienda_nome?: string | null;
  persona_nome?: string | null;
  percorso_nome?: string | null;
  da_dove?: DatiDaDove | null;
  ultima?: Ultima | null;
  ultima_nota?: string | null;
  tag?: TagRiga[];
  campi?: Record<string, unknown> | null;
}

export const CHIAVE_ELENCO = "elenco-trattative";

const PAGINA = 1000;

export const useElencoTrattative = (percorso: string | undefined, segue: string | null, tag: string | null, attivo: boolean, ordine: Ordine | null = null) => {
  const dp = useDataProvider();
  return useQuery({
    queryKey: [CHIAVE_ELENCO, percorso, segue, tag, ordine],
    enabled: attivo && !!percorso,
    placeholderData: (prima) => prima,
    queryFn: async () => {
      const filter = { ...SEMPRE_APERTE, percorso, ...(segue ? { segue } : {}), ...(tag ? { tag } : {}) };
      const righe: RigaElenco[] = [];
      for (let page = 1; ; page++) {
        const { data, total } = await dp.getList<RigaElenco>("trattative", {
          filter,
          pagination: { page, perPage: PAGINA },
          sort: ordine ? { field: ordine.campo, order: ordine.dir === "desc" ? "DESC" : "ASC" } : { field: "creato", order: "ASC" },
          meta: { elenco: true },
        });
        righe.push(...data);
        if (data.length < PAGINA || righe.length >= (total ?? 0)) return righe;
      }
    },
  });
};

const etichetta = (elenco: { valore: string; etichetta: string }[], v?: string | null) =>
  v ? (elenco.find((x) => x.valore === v)?.etichetta ?? v) : null;

const NUMERO = { tipo: "numero" as const, opzioni: [], svuotabile: true };
const SCELTA = (opzioni: { valore: string; etichetta: string }[]) => ({ tipo: "scelta" as const, opzioni, svuotabile: true });
const LUNGO = { tipo: "testo" as const, opzioni: [], svuotabile: true, lungo: true };

export const colonneTrattative = ({
  fasi,
  tutteLeFasi = fasi,
  percorsi = [],
  sposta,
  nomeDi,
  sogliaDi,
  oggi,
}: {
  fasi: FaseRiga[];
  tutteLeFasi?: FaseRiga[];
  percorsi?: Percorso[];
  sposta?: (t: Trattativa, faseId: string, altro?: Record<string, unknown>) => void;
  nomeDi: (email?: string | null) => string;
  sogliaDi: (fase: string) => number | null;
  oggi: string;
}): Colonna<RigaElenco>[] => {
  const faseDi = (id: string) => fasi.find((f) => f.id === id);
  const aperta = (t: RigaElenco) => faseDi(t.fase_id)?.tipo === "aperta";
  return [
    {
      id: "azienda",
      etichetta: "Azienda",
      largo: "max-w-[200px] sm:max-w-[280px]",
      modifica: legameRiga<RigaElenco>("trattative", "aziende", "azienda_id", (t) => t.azienda_nome, { soloMatita: true }),
      cella: (t) =>
        t.azienda_id ? (
          <span className="font-medium">
            <VersoScheda to={pathAzienda(t.azienda_id)}>{t.azienda_nome}</VersoScheda>
          </span>
        ) : (
          <Vuoto />
        ),
    },
    {
      id: "persona",
      etichetta: "Persona",
      largo: "max-w-[220px]",
      modifica: legameRiga<RigaElenco>("trattative", "persone", "persona_id", (t) => t.persona_nome),
      cella: (t) => (t.persona_id ? <VersoScheda to={pathPersona(t.persona_id)}>{t.persona_nome}</VersoScheda> : <Vuoto />),
    },
    {
      id: "fase",
      etichetta: "Fase",
      modifica: (t) =>
        sposta
          ? { editore: { tipo: "scelta", opzioni: fasi.map((f) => ({ valore: f.id, etichetta: f.nome })), svuotabile: false }, valore: t.fase_id, azione: (v) => sposta(t, String(v)) }
          : null,
      cella: (t) => {
        const fase = fasi.find((f) => f.id === t.fase_id);
        return <StatoCella stato={{ fase: fase?.nome ?? t.fase_id, tipo: fase?.tipo, trattativa_id: t.id }} />;
      },
    },
    { id: "valore", etichetta: "Valore", cella: (t) => <Euro v={t.valore} /> },
    { id: "canone", etichetta: "Canone", modifica: valoreRiga<RigaElenco>("trattative", "canone", NUMERO), cella: (t) => <Euro v={t.canone} /> },
    { id: "avvio", etichetta: "Avvio", modifica: valoreRiga<RigaElenco>("trattative", "avvio", NUMERO), cella: (t) => <Euro v={t.avvio} /> },
    {
      id: "prossimo_passo",
      etichetta: "Prossimo passo",
      largo: "max-w-[260px]",
      modifica: (t) => testoRiga<RigaElenco>("trattative", "prossimo_passo", { valida: (v) => (aperta(t) && !String(v ?? "").trim() ? OBBLIGATORIO_PASSO : null) })(t),
      cella: (t) => <Testo v={t.prossimo_passo} />,
    },
    {
      id: "prossimo_il",
      etichetta: "Prossimo il",
      modifica: (t) => valoreRiga<RigaElenco>("trattative", "prossimo_il", { tipo: "istante", opzioni: [], svuotabile: !aperta(t) })(t),
      cella: (t) => <GiornoOra v={t.prossimo_il} />,
    },
    { id: "segue", etichetta: "Segue", cella: (t) => <CellaSegue valore={t.segue} destino={{ su: "trattativa", id: t.id }} /> },
    { id: "temperatura", etichetta: "Temperatura", modifica: valoreRiga<RigaElenco>("trattative", "temperatura", SCELTA(TEMPERATURE)), cella: (t) => <Testo v={etichetta(TEMPERATURE, t.temperatura)} /> },
    { id: "da_dove", etichetta: "Da dove", largo: "max-w-[320px]", cella: (t) => <DaDove d={t.da_dove} /> },
    { id: "note", etichetta: "Note", largo: "max-w-[260px]", modifica: testoRiga<RigaElenco>("trattative", "note", { editore: LUNGO }), cella: (t) => <TestoIntero v={t.note} /> },
    { id: "ultima", etichetta: "Ultima attività", largo: "max-w-[280px]", cella: (t) => <UltimaAttivita u={t.ultima} nomeDi={nomeDi} /> },
    {
      id: "mossa_il",
      etichetta: "Ultima mossa",
      cella: (t) => {
        const ferma = giorniFerma(t, faseDi(t.fase_id)?.tipo ?? "aperta", sogliaDi(t.fase_id), oggi);
        return ferma === null ? <span className="text-ink2 tabular-nums">{quandoMossa(t.mossa_il, oggi)}</span> : <Fermo giorni={ferma} />;
      },
    },
    { id: "motivo_perso", etichetta: "Motivo perso", modifica: valoreRiga<RigaElenco>("trattative", "motivo_perso", SCELTA(MOTIVI_PERSO)), cella: (t) => <Testo v={etichetta(MOTIVI_PERSO, t.motivo_perso)} /> },
    { id: "ultima_nota", etichetta: "Ultima nota", largo: "max-w-[260px]", cella: (t) => <TestoIntero v={t.ultima_nota} /> },
    {
      id: "percorso",
      etichetta: "Percorso",
      modifica: (t) =>
        sposta
          ? {
              editore: { tipo: "scelta", opzioni: percorsi.map((x) => ({ valore: x.id, etichetta: x.nome })), svuotabile: false },
              valore: t.percorso,
              azione: (v) => {
                const fase = faseDiPartenza(tutteLeFasi, String(v));
                if (fase) sposta(t, fase.id, { percorso: v });
              },
            }
          : null,
      cella: (t) => <Testo v={t.percorso_nome} />,
    },
    { id: "tag", etichetta: "Tag", modifica: tagRiga<RigaElenco>("trattativa"), cella: (t) => <TagCella tag={t.tag} /> },
    { id: "creato", etichetta: "Creata", cella: (t) => <Quando v={t.creato} /> },
    { id: "creato_da", etichetta: "Creata da", cella: (t) => <Socio v={nomeDi(t.creato_da)} /> },
    { id: "aggiornato", etichetta: "Aggiornata", cella: (t) => <Quando v={t.aggiornato} /> },
    { id: "azienda_telefono", etichetta: "Telefono azienda", modifica: campoAzienda<RigaElenco>("azienda_telefono", "telefono"), cella: (t) => <LinkTelefono valore={t.azienda_telefono} /> },
    { id: "azienda_sito", etichetta: "Sito azienda", largo: "max-w-[220px]", modifica: campoAzienda<RigaElenco>("azienda_sito", "sito"), cella: (t) => <Sito v={t.azienda_sito} /> },
    { id: "azienda_comune", etichetta: "Comune", largo: "max-w-[180px]", modifica: campoAzienda<RigaElenco>("azienda_comune", "comune"), cella: (t) => <Testo v={t.azienda_comune} /> },
    { id: "azienda_categoria", etichetta: "Categoria", largo: "max-w-[200px]", modifica: campoAzienda<RigaElenco>("azienda_categoria", "categoria"), cella: (t) => <Testo v={t.azienda_categoria} /> },
    { id: "persona_ruolo", etichetta: "Posizione", largo: "max-w-[200px]", modifica: campoPersona<RigaElenco>("persona_ruolo", "ruolo"), cella: (t) => <Testo v={t.persona_ruolo} /> },
    { id: "persona_telefono", etichetta: "Telefono persona", modifica: campoPersona<RigaElenco>("persona_telefono", "telefono"), cella: (t) => <LinkTelefono valore={t.persona_telefono} /> },
    { id: "persona_email", etichetta: "Email persona", largo: "max-w-[240px]", modifica: campoPersona<RigaElenco>("persona_email", "email"), cella: (t) => <LinkEmail valore={t.persona_email} /> },
  ];
};

export const Elenco = ({
  fasi,
  righe,
  stato,
  ordine,
  onOrdina,
  chiaveRighe,
}: {
  fasi: FaseRiga[];
  righe: RigaElenco[];
  stato: StatoColonne<RigaElenco>;
  ordine: Ordine | null;
  onOrdina: (o: Ordine) => void;
  chiaveRighe?: string;
}) => {
  const azioni = useContext(AzioniRiga);
  const navigate = useNavigate();
  const inOrdine = useMemo(() => {
    if (ordine) return righe;
    const posti = new Map(fasi.map((f, i) => [f.id, i]));
    return [...righe].sort((a, b) => (posti.get(a.fase_id) ?? 99) - (posti.get(b.fase_id) ?? 99));
  }, [fasi, righe, ordine]);
  return (
    <div className="mx-5 mb-4 flex min-h-0 flex-1 flex-col">
      <TabellaCrm<RigaElenco>
        stato={stato}
        propria="Trattativa"
        righe={inOrdine}
        ordine={ordine}
        onOrdina={onOrdina}
        onRiga={(t) => navigate(`/trattative/${t.id}`)}
        perMenu={(t) => ({ id: t.id, nome: t.azienda_nome ?? t.persona_nome ?? undefined, archiviata_il: t.archiviata_il })}
        onMenu={azioni}
        className="min-h-0 flex-1"
        chiaveRighe={chiaveRighe}
      />
    </div>
  );
};
