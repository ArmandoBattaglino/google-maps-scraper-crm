import type { MouseEvent, ReactNode } from "react";
import { RecordContextProvider } from "ra-core";
import { ArrowDown, ArrowUp, ArrowUpDown, SquareCheck, type LucideIcon } from "lucide-react";
import { CellaPuntini, TestataPuntini, type RigaAzioni } from "@/crm/azioni/MenuRiga";
import { ICONA_ENTITA } from "@/crm/entita";
import { cn } from "@/lib/utils";
import { CellaCrm, useScritture } from "./CellaCrm";
import { larghezzeTabella, ManigliaLarghezza, stileColonna, useSpostaColonne } from "./testate";
import type { Colonna, StatoColonne } from "./useColonne";

const CELLA_FISSA = "sticky left-0 z-[1] border-r border-line bg-background";
const TESTATA_FISSA = "left-0 z-[3] border-r border-line";

export type Propria = "Azienda" | "Persona" | "Trattativa" | "Compito";

const ICONA_DI: Record<Propria, LucideIcon> = {
  Azienda: ICONA_ENTITA.aziende,
  Persona: ICONA_ENTITA.persone,
  Trattativa: ICONA_ENTITA.trattative,
  Compito: SquareCheck,
};

export const entitaDi = (id: string, propria: Propria): Propria => {
  if (propria !== "Azienda" && id.startsWith("azienda")) return "Azienda";
  if (propria !== "Persona" && (id.startsWith("persona") || id === "persone")) return "Persona";
  if (propria !== "Trattativa" && (id.startsWith("trattativ") || (propria === "Persona" && id === "valore"))) return "Trattativa";
  return propria;
};

export interface Ordine {
  campo: string;
  dir: "asc" | "desc";
}

export interface Sezione<R> {
  chiave: string;
  titolo: ReactNode;
  numero: ReactNode;
  scaduta?: boolean;
  righe: R[];
  piede?: ReactNode;
}

const puoOrdinare = <R,>(c: Colonna<R>) => !c.id.startsWith("campi.") && !c.fermaOrdine;

const DentroCella = ({ id, largo, children }: { id: string; largo?: string; children: ReactNode }) => (
  <div data-colonna={id} className={cn("truncate", largo)}>
    {children}
  </div>
);

export const TabellaCrm = <R extends { id: string | number }>({
  stato,
  propria,
  righe = [],
  sezioni,
  ordine,
  onOrdina,
  onRiga,
  datiRiga,
  perMenu,
  onMenu,
  senzaEntita,
  className,
  chiaveRighe,
  onScrittura,
}: {
  stato: StatoColonne<R>;
  propria: Propria;
  righe?: R[];
  sezioni?: Sezione<R>[];
  ordine: Ordine | null;
  onOrdina: (o: Ordine) => void;
  onRiga?: (r: R) => void;
  datiRiga?: (r: R) => Record<string, string>;
  perMenu: (r: R) => RigaAzioni;
  onMenu: ((e: MouseEvent, riga: RigaAzioni) => void) | null;
  senzaEntita?: boolean;
  className?: string;
  chiaveRighe?: string;
  onScrittura?: () => void;
}) => {
  const colonne: Colonna<R>[] = stato.visibili;
  const [prima, ...altre] = colonne;
  const { propsDi, segnoDi } = useSpostaColonne(
    altre.map((c) => c.id),
    (ids) => stato.ordina(ids),
  );

  const tratti: { entita: Propria; quante: number }[] = [];
  for (const c of colonne) {
    const entita = entitaDi(c.id, propria);
    const ultimo = tratti.at(-1);
    if (ultimo?.entita === entita) ultimo.quante += 1;
    else tratti.push({ entita, quante: 1 });
  }
  const conGruppi = tratti.length > 1 && !senzaEntita;
  let somma = 0;
  const inizi = new Set(
    tratti.map((t) => {
      const c = colonne[somma];
      somma += t.quante;
      return c?.id;
    }),
  );
  inizi.delete(prima?.id);

  const scritture = useScritture(righe, chiaveRighe ?? JSON.stringify(ordine), onScrittura);

  const riga = (originale: R) => {
    const r = scritture.vista(originale);
    return (
      <RecordContextProvider key={String(r.id)} value={r}>
        <tr
          data-riga={String(r.id)}
          {...datiRiga?.(r)}
          onClick={onRiga ? () => onRiga(r) : undefined}
          onContextMenu={onMenu ? (e) => onMenu(e, perMenu(r)) : undefined}
          className={cn("group", onRiga && "cursor-pointer")}
        >
          {colonne.map((c, i) => (
            <CellaCrm
              key={c.id}
              colonna={c}
              riga={r}
              fissa={i === 0}
              scritture={scritture}
              stile={stileColonna(c.id, "none")}
              classe={cn(i === 0 && CELLA_FISSA, inizi.has(c.id) && "border-l border-l-line")}
            >
              <DentroCella id={c.id} largo={stato.larghezze[c.id] ? undefined : c.largo}>
                {c.cella(r)}
              </DentroCella>
            </CellaCrm>
          ))}
          <CellaPuntini onApri={onMenu ? (e) => onMenu(e, perMenu(r)) : undefined} />
        </tr>
      </RecordContextProvider>
    );
  };

  return (
    <div data-slot="table-container" className={cn("relative w-full overflow-auto", className)}>
      <table
        data-tabella-crm
        data-elenco={propria === "Trattativa" ? "" : undefined}
        className="w-full caption-bottom border-separate border-spacing-0 text-sm"
        style={larghezzeTabella(colonne.map((c) => ({ chiave: c.id, larghezza: stato.larghezze[c.id] })))}
      >
        <thead>
          {conGruppi ? (
            <tr data-gruppi-colonne>
              {tratti.map((t, i) => {
                const Icona = ICONA_DI[t.entita];
                return (
                  <th
                    key={`${t.entita}-${i}`}
                    scope="colgroup"
                    colSpan={t.quante}
                    data-gruppo-colonne={t.entita}
                    className={cn(
                      "sticky top-0 z-[2] h-7 border-b border-line2 bg-background px-2 text-left text-xs font-medium whitespace-nowrap text-mute",
                      i === 0 && "left-0 z-[3]",
                      i > 0 && "border-l border-line",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:text-mute-deco">
                      <Icona />
                      {t.entita}
                    </span>
                  </th>
                );
              })}
              <th className="sticky top-0 right-0 z-[2] w-0 border-b border-line2 bg-background p-0" />
            </tr>
          ) : null}
          <tr>
            {colonne.map((c, i) => {
              const attuale = ordine?.campo === (c.ordina ?? c.id) ? ordine : null;
              return (
                <th
                  key={c.id}
                  scope="col"
                  data-testata={c.id}
                  aria-sort={attuale ? (attuale.dir === "asc" ? "ascending" : "descending") : undefined}
                  {...(i === 0 ? {} : propsDi(c.id))}
                  style={stileColonna(c.id, "none")}
                  className={cn(
                    "sticky z-[2] border-b border-line bg-background px-2 py-2 text-left font-medium whitespace-nowrap text-ink2",
                    conGruppi ? "top-7" : "top-0",
                    i === 0 ? TESTATA_FISSA : "cursor-grab active:cursor-grabbing",
                    inizi.has(c.id) && "border-l border-l-line",
                    segnoDi(c.id),
                  )}
                >
                  {puoOrdinare(c) ? (
                    <button
                      type="button"
                      title={attuale ? "Clic per invertire l'ordine" : "Clic per ordinare"}
                      className="group/ordina inline-flex items-center gap-1 outline-none hover:text-ink focus-visible:text-ink [&_svg]:size-3"
                      onClick={() => onOrdina({ campo: c.ordina ?? c.id, dir: attuale?.dir === "asc" ? "desc" : "asc" })}
                    >
                      {c.etichetta}
                      {attuale ? attuale.dir === "asc" ? <ArrowUp /> : <ArrowDown /> : <ArrowUpDown className="opacity-0 group-hover/ordina:opacity-100" />}
                    </button>
                  ) : (
                    c.etichetta
                  )}
                  <ManigliaLarghezza chiave={c.id} nome={c.etichetta} onLarghezza={(l) => stato.allarga(c.id, l)} />
                </th>
              );
            })}
            <TestataPuntini sopra={conGruppi ? "top-7" : "top-0"} />
          </tr>
        </thead>
        {sezioni ? (
          sezioni.map((s) => (
            <tbody key={s.chiave} data-gruppo={s.chiave}>
              <tr data-testata-gruppo>
                <th scope="rowgroup" colSpan={colonne.length + 1} className="h-10 border-b border-line bg-background p-0 text-left font-semibold text-ink">
                  {}
                  <span className="sticky left-0 inline-flex h-10 items-center gap-2.5 px-2">
                    {s.titolo}
                    <span data-numero className={cn("rounded-sm px-1.5 text-xs font-normal tabular-nums", s.scaduta ? "bg-danger-soft text-danger" : "bg-hover text-mute")}>
                      {s.numero}
                    </span>
                  </span>
                </th>
              </tr>
              {s.righe.map(riga)}
              {s.piede ? (
                <tr>
                  <td colSpan={colonne.length + 1} className="border-b border-line2 p-0">
                    <span className="sticky left-0 inline-block px-1 py-1">{s.piede}</span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          ))
        ) : (
          <tbody>{scritture.disposte.map(riga)}</tbody>
        )}
      </table>
    </div>
  );
};
