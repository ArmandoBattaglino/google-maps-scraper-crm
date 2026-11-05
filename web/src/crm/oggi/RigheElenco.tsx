import type { ReactNode } from "react";
import { LinkBase } from "ra-core";
import { LogoAzienda } from "@/components/crm/forme";
import { ESITI, TIPI, type TipoAttivita } from "@/crm/attivita/campi";
import { StatoDaTesto } from "@/crm/colonne/celle";
import { useNomi } from "@/crm/attivita/dati";
import { oraDi } from "@/crm/attivita/tempo";
import { dataCorta, giorniDa } from "@/crm/tempo";
import { Fermo } from "@/crm/trattative/Fermo";
import { cn } from "@/lib/utils";
import type { Risorsa } from "./dati";

export type RigaCerca = { id: string } & Record<string, unknown>;

export const COLONNE: Record<Risorsa, string[]> = {
  aziende: ["nome", "telefono", "referente", "comune", "stato", "tentativi", "richiamare_il"],
  trattative: ["azienda.nome", "persona.nome", "fase.nome", "prossimo_passo", "prossimo_il", "mossa_il"],
  attivita: ["tipo", "quando", "testo", "esito", "esito_azienda", "creato_da", "azienda_id", "persona_id", "trattativa_id", "azienda.nome"],
};

const GRIGLIA: Record<Risorsa, string> = {
  aziende: "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_128px_128px_112px]",
  trattative: "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.6fr)_136px]",
  attivita: "md:grid-cols-[120px_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_112px]",
};

const TESTE: Record<Risorsa, string[]> = {
  aziende: ["Azienda", "Chi chiedere", "Telefono", "Stato", "Richiamo"],
  trattative: ["Azienda", "Fase", "Prossimo passo", "Ferma"],
  attivita: ["Tipo", "Azienda", "Testo", "Chi", "Quando"],
};

const testo = (v: unknown) => (typeof v === "string" ? v : "");
const quando = (v: unknown) => (typeof v === "string" && v ? `${dataCorta(v)} ${oraDi(v)}` : "");

const Riga = ({ risorsa, a, children }: { risorsa: Risorsa; a: string; children: ReactNode }) => (
  <li>
    <LinkBase
      to={a}
      data-riga
      className={cn(
        "grid grid-cols-1 items-center gap-x-3 border-b border-line2 px-6 py-2 text-cella outline-none hover:bg-riga-hover focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 md:h-riga md:py-0",
        GRIGLIA[risorsa],
      )}
    >
      {children}
    </LinkBase>
  </li>
);

const Nome = ({ nome }: { nome: string }) => (
  <span className="flex min-w-0 items-center gap-2.5">
    <LogoAzienda nome={nome} />
    <span className="truncate font-medium text-ink">{nome}</span>
  </span>
);

const Azienda = ({ r }: { r: RigaCerca }) => (
  <Riga risorsa="aziende" a={`/aziende/${r.id}`}>
    <Nome nome={testo(r.nome)} />
    <span className="truncate text-ink2">{testo(r.referente)}</span>
    <span className="truncate text-ink2 tabular-nums">{testo(r.telefono)}</span>
    <span className="flex min-w-0 items-center">{testo(r.stato) ? <StatoDaTesto testo={testo(r.stato)} segni={r.stato_segni} /> : null}</span>
    <span className="text-ink2 tabular-nums">{quando(r.richiamare_il)}</span>
  </Riga>
);

const Trattativa = ({ r, ferma }: { r: RigaCerca; ferma: boolean }) => {
  const dal = testo(r.mossa_il);
  const nome = testo(r["azienda.nome"]) || testo(r["persona.nome"]) || "Trattativa senza nome";
  return (
    <Riga risorsa="trattative" a={`/trattative/${r.id}`}>
      <Nome nome={nome} />
      <span className="truncate text-ink2">{testo(r["fase.nome"])}</span>
      <span className="truncate text-ink2">{testo(r.prossimo_passo) || "Nessun passo"}</span>
      <span>{ferma && dal ? <Fermo giorni={giorniDa(dal)} /> : <span className="text-ink2">{dal ? dataCorta(dal) : ""}</span>}</span>
    </Riga>
  );
};

const AttivitaRiga = ({ r, chi }: { r: RigaCerca; chi: string | null }) => {
  const tipo = TIPI[testo(r.tipo) as TipoAttivita];
  const esito = ESITI[testo(r.esito_azienda) || testo(r.esito)];
  const [risorsa, id] = r.trattativa_id
    ? ["trattative", r.trattativa_id]
    : r.azienda_id
      ? ["aziende", r.azienda_id]
      : ["persone", r.persona_id];
  const Icona = tipo?.icona;
  return (
    <Riga risorsa="attivita" a={`/cronologia/${risorsa}/${String(id)}`}>
      <span className="flex items-center gap-2 text-ink2 [&_svg]:size-3.5 [&_svg]:text-mute-deco">
        {Icona ? <Icona /> : null}
        {tipo?.nome ?? testo(r.tipo)}
      </span>
      <span className="truncate text-ink">{testo(r["azienda.nome"])}</span>
      <span className="truncate text-ink2">{esito?.nome ?? testo(r.testo)}</span>
      <span className="truncate text-ink2">{chi}</span>
      <span className="text-ink2 tabular-nums">{quando(r.quando)}</span>
    </Riga>
  );
};

export const RigheElenco = ({ risorsa, righe, chiave }: { risorsa: Risorsa; righe: RigaCerca[]; chiave: string }) => {
  const nomeDi = useNomi();
  return (
    <>
      <div className={cn("hidden h-8 items-center gap-x-3 border-y border-line px-6 text-xs text-mute md:grid", GRIGLIA[risorsa])}>
        {TESTE[risorsa].map((t) => (
          <span key={t}>{t === "Ferma" && !chiave.startsWith("ferme") ? "Ultima mossa" : t}</span>
        ))}
      </div>
      <ul>
        {righe.map((r) =>
          risorsa === "aziende" ? (
            <Azienda key={r.id} r={r} />
          ) : risorsa === "trattative" ? (
            <Trattativa key={r.id} r={r} ferma={chiave.startsWith("ferme")} />
          ) : (
            <AttivitaRiga key={r.id} r={r} chi={nomeDi(testo(r.creato_da) || null)} />
          ),
        )}
      </ul>
    </>
  );
};
