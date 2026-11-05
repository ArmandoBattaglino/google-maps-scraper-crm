import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { Chip, ChipSocio, type TonoChip } from "@/components/crm/forme";
import { ESITI, TIPI, type TipoAttivita } from "@/crm/attivita/campi";
import { EtichettaEsito, tonoDellEsito } from "@/crm/aziende/celle";
import { quandoBreve } from "@/crm/scheda/formati";
import { dataCorta, dataCortaOra } from "@/crm/tempo";
import { tonoDi } from "@/crm/tag/colori";
import { euro, toniDelleFasi } from "@/crm/trattative/tipi";
import { useFasi } from "@/crm/trattative/useBacheca";
import { PannelloOrigine } from "@/crm/origini/Pannello";
import { daDove, type DatiDaDove, type DueRighe } from "./daDove";

const fermaLaRiga = (e: MouseEvent) => e.stopPropagation();

export const Vuoto = () => <span className="text-assente">—</span>;

export const Socio = ({ v }: { v?: string | null }) => (v ? <ChipSocio nome={v} /> : <Vuoto />);

export const Testo = ({ v }: { v?: string | number | null }) =>
  v === null || v === undefined || v === "" ? <Vuoto /> : <span className="text-ink2">{v}</span>;

export const TestoIntero = ({ v }: { v?: string | null }) =>
  v ? (
    <span className="text-ink2" title={v}>
      {v}
    </span>
  ) : (
    <Vuoto />
  );

export const Numero = ({ v, zeroVuoto }: { v?: string | number | null; zeroVuoto?: boolean }) => {
  if (v === null || v === undefined || v === "" || (zeroVuoto && Number(v) === 0)) return <Vuoto />;
  const [intera, decimali] = String(Number(v)).split(".");
  const testo = intera.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (decimali ? `,${decimali}` : "");
  return <span className="text-ink2 tabular-nums">{testo}</span>;
};

export const Quando = ({ v }: { v?: string | null }) => (v ? <span className="text-ink2 tabular-nums">{quandoBreve(v)}</span> : <Vuoto />);
export const Giorno = ({ v }: { v?: string | null }) => (v ? <span className="text-ink2 tabular-nums">{dataCorta(v)}</span> : <Vuoto />);
export const GiornoOra = ({ v }: { v?: string | null }) => (v ? <span className="text-ink2 tabular-nums">{dataCortaOra(v)}</span> : <Vuoto />);
export const Euro = ({ v }: { v?: string | number | null }) =>
  v === null || v === undefined || v === "" ? <Vuoto /> : <span className="text-ink2 tabular-nums">{euro(v)}</span>;

export const VersoScheda = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} onClick={fermaLaRiga} className="text-ink hover:underline">
    {children}
  </Link>
);

export const Sito = ({ v }: { v?: string | null }) => {
  if (!v) return <Vuoto />;
  const nome = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  if (!/^https?:\/\//i.test(v)) return <span className="text-ink2">{nome}</span>;
  return (
    <a href={v} target="_blank" rel="noreferrer" onClick={fermaLaRiga} className="text-acc-ink hover:underline">
      {nome}
    </a>
  );
};

export const DueRigheCella = ({ sopra, sotto }: { sopra: string; sotto?: string }) => (
  <span className="block min-w-0 leading-[15px]" title={sotto ? `${sopra}\n${sotto}` : sopra}>
    <span className="block truncate text-ink2">{sopra}</span>
    {sotto ? <span className="block truncate text-xs leading-[15px] text-mute">{sotto}</span> : null}
  </span>
);

export const DaDove = ({ d }: { d?: DatiDaDove | null }) => {
  const r: DueRighe = daDove(d);
  const [aperto, setAperto] = useState(false);
  const arrivo = d?.arrivo;
  if (!arrivo) return <DueRigheCella sopra={r.sopra} sotto={r.sotto} />;
  return (
    <span className="flex min-w-0 items-center gap-2" data-da-dove={arrivo.id}>
      <button
        type="button"
        data-apri-arrivo
        className="min-w-0 flex-1 cursor-pointer text-left"
        onClick={(e) => {
          e.stopPropagation();
          setAperto(true);
        }}
      >
        <DueRigheCella sopra={r.sopra} sotto={r.sotto} />
      </button>
      {aperto ? <PannelloOrigine id={arrivo.id} onChiudi={() => setAperto(false)} /> : null}
    </span>
  );
};

export interface Ultima {
  quando: string;
  tipo: TipoAttivita;
  esito?: string | null;
  testo?: string | null;
  fase?: string | null;
  chi?: string | null;
}

export const cosaFatta = (u: Ultima): string => {
  const tipo = TIPI[u.tipo]?.nome ?? u.tipo;
  if (u.tipo === "fase") return u.fase ? `Spostata in ${u.fase}` : "Spostata";
  const esito = u.esito && u.esito !== "inviato" ? (ESITI[u.esito]?.nome ?? u.esito) : "";
  const dettaglio = esito || (u.testo ?? "").replace(/\s+/g, " ").trim();
  return dettaglio ? `${tipo}: ${dettaglio}` : tipo;
};

export const UltimaAttivita = ({ u, nomeDi }: { u?: Ultima | null; nomeDi: (email?: string | null) => string }) => {
  if (!u) return <Vuoto />;
  const nome = nomeDi(u.chi);
  const chi = nome && (nome !== u.chi || nome.includes("@")) ? nome : "";
  return <DueRigheCella sopra={quandoBreve(u.quando)} sotto={[cosaFatta(u), chi].filter(Boolean).join(" · ")} />;
};

export interface Stato {
  fase: string;
  tipo?: string | null;
  trattativa_id?: string | null;
  archiviata?: boolean;
  altre_aperte?: number;
  esito?: string | null;
}
const TONO_FASE: Record<string, TonoChip> = { cliente: "verde", perso: "rosso" };

export const SegniStato = ({ archiviata, altre }: { archiviata?: boolean; altre?: number }) => (
  <>
    {altre ? (
      <span data-stato-altre title="Altre trattative aperte" className="pl-1.5 text-xs text-mute tabular-nums">
        +{altre}
      </span>
    ) : null}
    {archiviata ? (
      <span data-stato-archiviata title="La trattativa è archiviata" className="pl-1.5 text-xs text-mute">
        archiviata
      </span>
    ) : null}
  </>
);

export const StatoCella = ({ stato }: { stato?: Stato | null }) => {
  const { fasi } = useFasi();
  const toni = useMemo(() => toniDelleFasi(fasi), [fasi]);
  if (!stato) return <Vuoto />;
  return (
    <>
      {stato.esito ? <EtichettaEsito esito={stato.esito} /> : <Chip tono={toni.get(stato.fase) ?? TONO_FASE[stato.tipo ?? ""] ?? "neutro"}>{stato.fase}</Chip>}
      <SegniStato archiviata={stato.archiviata} altre={stato.altre_aperte} />
    </>
  );
};

export const StatoDaTesto = ({ testo, segni }: { testo: string; segni?: unknown }) => {
  const { fasi } = useFasi();
  const toni = useMemo(() => toniDelleFasi(fasi), [fasi]);
  const s = (segni ?? {}) as { archiviata?: boolean; altre_aperte?: number };
  return (
    <>
      <Chip tono={segni ? (toni.get(testo) ?? "neutro") : tonoDellEsito(testo)}>{testo}</Chip>
      <SegniStato archiviata={s.archiviata} altre={s.altre_aperte} />
    </>
  );
};

export interface TagRiga {
  id: string;
  nome: string;
  colore: string;
}
const TAG_VISTI = 2;

export const TagCella = ({ tag }: { tag?: TagRiga[] }) => {
  if (!tag?.length) return <Vuoto />;
  const resto = tag.length - TAG_VISTI;
  return (
    <span className="flex items-center gap-1" title={tag.map((t) => t.nome).join(", ")}>
      {tag.slice(0, TAG_VISTI).map((t) => (
        <Chip key={t.id} tono={tonoDi(t.colore)}>
          {t.nome}
        </Chip>
      ))}
      {resto > 0 ? <span className="text-xs text-mute">+{resto}</span> : null}
    </span>
  );
};
