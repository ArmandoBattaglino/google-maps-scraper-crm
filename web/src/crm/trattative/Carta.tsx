import { memo, useContext, type MouseEvent, type ReactNode } from "react";
import { AzioniRiga, TrePuntini } from "@/crm/azioni/MenuRiga";
import { useDraggable } from "@dnd-kit/core";
import { LinkBase } from "ra-core";
import { useNavigate } from "react-router";
import { ChipSocio } from "@/components/crm/forme";
import { cn } from "@/lib/utils";
import { dataCortaOra, dataNumeri, giornoRoma } from "@/crm/tempo";
import { Fermo, giorniFerma, quandoMossa } from "./Fermo";
import { MOTIVI_PERSO, euro, titoloTrattativa, type FaseRiga, type Trattativa } from "./tipi";

export interface DatiCarta {
  t: Trattativa;
  azienda?: string;
  persona?: string;
  segue?: string;
  tipo: FaseRiga["tipo"];
  soglia: number | null;
  oggi: string;
}

const piede = ({ t, tipo, soglia, oggi }: DatiCarta): ReactNode => {
  if (tipo === "cliente") return `firmata il ${dataNumeri(t.mossa_il)}`;
  if (tipo === "perso") {
    const m = MOTIVI_PERSO.find((x) => x.valore === t.motivo_perso)?.etichetta;
    return m ? `motivo: ${m.toLowerCase()}` : "senza motivo";
  }
  const ferma = giorniFerma(t, tipo, soglia, oggi);
  return ferma === null ? `mossa ${quandoMossa(t.mossa_il, oggi)}` : <Fermo giorni={ferma} />;
};

const Passo = ({ t, tipo }: DatiCarta) => {
  if (tipo !== "aperta") return null;
  if (!t.prossimo_passo) return <p className="mt-0.5 text-warn">Manca il prossimo passo</p>;
  const scaduto = t.prossimo_il && giornoRoma(t.prossimo_il) < giornoRoma();
  return (
    <p className="mt-0.5 line-clamp-2 text-ink2">
      {t.prossimo_passo}
      {t.prossimo_il ? (
        <span className={cn("ml-1.5 whitespace-nowrap text-xs text-mute", scaduto && "font-medium text-danger")}>
          {dataCortaOra(t.prossimo_il)}
        </span>
      ) : null}
    </p>
  );
};

const Sigla = ({ nome }: { nome: string }) => {
  const pezzi = nome.trim().split(/\s+/).filter(Boolean);
  const sigla = (pezzi.length > 1 ? pezzi[0][0] + pezzi[1][0] : (pezzi[0] ?? "?").slice(0, 2)).toUpperCase();
  return (
    <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-hover text-[9.5px] font-semibold text-ink2">
      {sigla}
    </span>
  );
};

const CartaVista = (d: DatiCarta) => (
  <>
    <h4 className="truncate font-medium text-ink">
      <LinkBase to={`/trattative/${d.t.id}`} draggable={false} className="hover:underline hover:underline-offset-3">
        {titoloTrattativa(d.azienda, d.persona)}
      </LinkBase>
    </h4>
    <Passo {...d} />
    <div className="mt-3 flex items-center gap-2 text-xs text-ink2">
      {d.persona ? <Sigla nome={d.persona} /> : null}
      <span className="min-w-0 truncate">{d.persona}</span>
      <span className="ml-auto font-medium whitespace-nowrap text-ink tabular-nums" data-valore={d.t.valore ?? 0}>
        {euro(d.t.valore)}
      </span>
    </div>
    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line2 pt-2.5 text-xs text-mute">
      <span className="flex-none whitespace-nowrap">{piede(d)}</span>
      {d.segue ? <ChipSocio nome={d.segue} /> : <span className="text-assente">—</span>}
    </div>
  </>
);

const CLASSI = "rounded-lg border border-line bg-background p-3 shadow-carta";

export const Carta = memo((d: DatiCarta) => {
  const navigate = useNavigate();
  const azioni = useContext(AzioniRiga);
  const riga = { id: d.t.id, nome: titoloTrattativa(d.azienda, d.persona), archiviata_il: d.t.archiviata_il };
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: d.t.id,
    data: { t: d.t },
    attributes: { roleDescription: "carta da spostare" },
  });
  const apri = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest("a")) navigate(`/trattative/${d.t.id}`);
  };
  return (
    <article
      ref={(n) => {
        setNodeRef(n);
        setActivatorNodeRef(n);
      }}
      data-carta={d.t.id}
      onClick={apri}
      onContextMenu={azioni ? (e) => azioni(e, riga) : undefined}
      {...attributes}
      {...listeners}
      className={cn(
        CLASSI,
        "relative mb-2 cursor-grab select-none outline-none [contain-intrinsic-size:auto_123px] [content-visibility:auto]",
        "hover:border-line-strong focus-visible:ring-3 focus-visible:ring-ring/50",
        d.tipo === "perso" && "opacity-[.62] hover:opacity-100",
        isDragging && "opacity-40",
      )}
    >
      <CartaVista {...d} />
      {azioni ? <TrePuntini className="absolute top-2 right-2" onApri={(e) => azioni(e, riga)} /> : null}
    </article>
  );
});
Carta.displayName = "Carta";

export const CartaInVolo = (d: DatiCarta) => (
  <div className={cn(CLASSI, "w-full cursor-grabbing shadow-pop select-none")}>
    <CartaVista {...d} />
  </div>
);
