import type { MouseEvent } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, ChipSocio } from "@/components/crm/forme";
import { TrePuntini } from "@/crm/azioni/MenuRiga";
import { cn } from "@/lib/utils";
import { diPersona, ESITI, TIPI, type Attivita } from "./campi";
import { useFatto } from "./dati";
import { dataCorta, oraDi } from "./tempo";

const RIQUADRO = "mt-1.5 max-w-[62ch] rounded-lg border border-line";
const TESTO = "break-words whitespace-pre-wrap";
const RIGA = "relative grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3";
const ORA = "text-xs whitespace-nowrap text-mute tabular-nums";

const inRitardo = (a: Attivita) => a.tipo === "compito" && !a.fatto_il && a.scadenza !== null && Date.parse(a.scadenza) < Date.now();

const Compito = ({ a }: { a: Attivita }) => {
  const { segna, salvando } = useFatto();
  const scaduto = inRitardo(a);
  return (
    <div
      data-compito={a.id}
      data-scaduto={scaduto}
      className={cn(RIQUADRO, "flex items-center gap-2.5 px-3 py-2 text-ink", scaduto && "border-danger bg-danger-soft text-danger")}
    >
      <Checkbox
        checked={Boolean(a.fatto_il)}
        disabled={salvando}
        onCheckedChange={(v) => void segna(a, Boolean(v))}
        aria-label={a.fatto_il ? `Riapri il compito: ${a.testo}` : `Segna fatto: ${a.testo}`}
        className={cn(scaduto && "border-danger bg-background")}
      />
      <span className={cn("min-w-0 break-words whitespace-pre-wrap", a.fatto_il && "text-mute line-through")}>{a.testo}</span>
      <span className={cn("ml-auto pl-3 text-xs whitespace-nowrap", scaduto ? "font-medium" : "text-ink2")}>
        {a.fatto_il
          ? `fatto ${dataCorta(a.fatto_il)}`
          : a.scadenza
            ? `${scaduto ? "scaduto" : "scade"} ${dataCorta(a.scadenza)}${oraDi(a.scadenza) === "23:59" ? "" : ` alle ${oraDi(a.scadenza)}`}`
            : "senza scadenza"}
      </span>
    </div>
  );
};

type ApriMenu = (e: MouseEvent, a: Attivita) => void;

const Ora = ({ a, onMenu, className }: { a: Attivita; onMenu?: ApriMenu; className?: string }) => (
  <span className="relative">
    <time dateTime={a.quando} className={cn(ORA, className)}>
      {oraDi(a.quando)}
    </time>
    {onMenu ? <TrePuntini className="absolute top-0 right-full mr-1 [li:hover_&]:opacity-100" onApri={(e) => onMenu(e, a)} /> : null}
  </span>
);

const CambioFase = ({ a, chi, fase, onMenu }: { a: Attivita; chi: string | null; fase: string; onMenu?: ApriMenu }) => {
  const Icona = TIPI.fase.icona;
  const cosa = a.testo.includes("→")
    ? a.testo
    : [fase ? `${TIPI.fase.nome} ${fase}` : "", a.testo !== fase ? a.testo : ""].filter(Boolean).join(" · ");
  const tutto = chi ? `${cosa} · ${chi}` : cosa;
  return (
    <li data-attivita={a.id} data-tipo="fase" onContextMenu={onMenu ? (e) => onMenu(e, a) : undefined} className={cn(RIGA, "items-center pb-2.5 text-xs text-mute")}>
      <span aria-hidden="true" className="z-[1] grid h-5 place-items-center">
        <span className="grid size-5 place-items-center rounded-full bg-background">
          <Icona className={cn("size-3", TIPI.fase.tinta)} />
        </span>
      </span>
      <span data-corpo className="min-w-0 truncate" title={tutto}>
        {tutto}
      </span>
      <Ora a={a} onMenu={onMenu} />
    </li>
  );
};

const Corpo = ({ a, automatica }: { a: Attivita; automatica: boolean }) => {
  if (a.tipo === "compito") return <Compito a={a} />;
  if (!a.testo.trim()) return null;
  if (automatica) return <div data-corpo className={cn("mt-0.5 max-w-[62ch] text-cella text-mute", TESTO)}>{a.testo}</div>;
  if (a.tipo === "nota") return <div data-corpo className={cn("mt-1.5 max-w-[62ch] rounded-lg border border-tipo-nota-line bg-tipo-nota-soft px-3 py-2.5 text-ink", TESTO)}>{a.testo}</div>;
  if (a.tipo === "chiamata") return <div data-corpo className={cn("mt-1 max-w-[62ch] text-ink", TESTO)}>{a.testo}</div>;
  return <div data-corpo className={cn(RIQUADRO, "px-3 py-2.5 text-ink", TESTO)}>{a.testo}</div>;
};

export const Evento = ({
  a,
  nomeDi,
  faseDi,
  onMenu,
}: {
  a: Attivita;
  nomeDi: (email: string | null) => string | null;
  faseDi: (id: string | null) => string;
  onMenu?: ApriMenu;
}) => {
  const chi = nomeDi(a.creato_da);
  if (a.tipo === "fase") return <CambioFase a={a} chi={chi} fase={faseDi(a.fase) || a.fase || ""} onMenu={onMenu} />;
  const tipo = TIPI[a.tipo];
  const Icona = tipo.icona;
  const persona = diPersona(a);
  const automatica = a.tipo === "nota" && !persona;
  const chiave = a.esito_azienda ?? a.esito;
  const esito = chiave && chiave !== "inviato" ? (ESITI[chiave] ?? { nome: chiave, tono: "neutro" as const }) : null;
  return (
    <li
      data-attivita={a.id}
      data-tipo={a.tipo}
      data-automatica={automatica ? "" : undefined}
      onContextMenu={onMenu ? (e) => onMenu(e, a) : undefined}
      className={cn(RIGA, "pb-5")}
    >
      <span
        aria-hidden="true"
        data-tondo
        className={cn(
          "z-[1] grid size-7 place-items-center rounded-full bg-background",
          automatica ? "border border-line text-mute-deco" : inRitardo(a) ? "bg-danger-soft text-danger" : tipo.tinta,
        )}
      >
        <Icona className="size-3.5" />
      </span>
      <div className={cn("min-w-0", persona ? "pt-[3px]" : "pt-1")}>
        {automatica ? (
          <>
            <span className="text-mute">{chi ?? tipo.nome}</span> <Chip tono="vuoto">automatica</Chip>
          </>
        ) : persona && chi ? (
          <>
            <ChipSocio nome={chi} /> <span className="text-ink2">{tipo.azione}</span>
          </>
        ) : chi ? (
          <>
            <b className="font-medium text-ink">{chi}</b> <span className="text-ink2">{tipo.azione}</span>
          </>
        ) : (
          <b className="font-medium text-ink">{tipo.nome}</b>
        )}
        {a.tipo === "chiamata" && a.durata !== null ? <span className="text-ink2">{`, ${Math.round(a.durata / 60)} min`}</span> : null}
        {esito ? (
          <span data-esito className="ml-1.5">
            <Chip tono={esito.tono}>{esito.nome}</Chip>
          </span>
        ) : null}
        <Corpo a={a} automatica={automatica} />
        {a.tipo === "chiamata" && a.scadenza ? (
          <p className="mt-1 text-xs text-ink2">
            Da richiamare {dataCorta(a.scadenza)} alle {oraDi(a.scadenza)}
          </p>
        ) : null}
      </div>
      <Ora a={a} onMenu={onMenu} className="pt-[5px]" />
    </li>
  );
};
