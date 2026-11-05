import { memo, useMemo, useState, type ComponentType } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { PallinoFase, type Fase } from "@/components/crm/forme";
import { cn } from "@/lib/utils";
import { Carta, CartaInVolo, type DatiCarta } from "./Carta";
import { euro, formaFase, numero, titoloTrattativa, type FaseRiga, type Trattativa } from "./tipi";

const collisione: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args));

const colonnaAccanto: KeyboardCoordinateGetter = (e, { context: { droppableContainers, droppableRects, collisionRect } }) => {
  if ((e.code !== "ArrowRight" && e.code !== "ArrowLeft") || !collisionRect) return undefined;
  e.preventDefault();
  const rects = droppableContainers
    .getEnabled()
    .map((c) => droppableRects.get(c.id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => a.left - b.left);
  const mezzo = collisionRect.left + collisionRect.width / 2;
  const dopo = e.code === "ArrowRight" ? rects.find((r) => r.left > mezzo) : rects.reverse().find((r) => r.right < mezzo);
  return dopo ? { x: dopo.left + (dopo.width - collisionRect.width) / 2, y: collisionRect.top } : undefined;
};

const ISTRUZIONI = {
  draggable:
    "Premi spazio o invio per prendere la carta, le frecce destra e sinistra per cambiare colonna, spazio o invio per lasciarla, esc per annullare.",
};

interface Colonna {
  fase: FaseRiga;
  righe: Trattativa[];
  valore: number;
}

const ColonnaBacheca = memo(
  ({
    colonna: { fase, righe, valore },
    forma,
    datiDi,
    onAggiungi,
    onArchiviaTutte,
    carta: CartaColonna,
  }: {
    colonna: Colonna;
    forma: Fase;
    datiDi: (t: Trattativa) => DatiCarta;
    onAggiungi?: (fase: FaseRiga) => void;
    onArchiviaTutte?: (fase: FaseRiga, righe: Trattativa[]) => void;
    carta: ComponentType<DatiCarta>;
  }) => {
    const { setNodeRef, isOver } = useDroppable({ id: fase.id });
    return (
      <section
        ref={setNodeRef}
        data-colonna={fase.id}
        aria-label={fase.nome}
        className={cn("min-w-0 rounded-lg bg-background px-1 pb-2", isOver && "bg-acc-soft")}
      >
        <header className="sticky top-0 z-10 flex items-center gap-2 bg-inherit px-1 pt-1.5 pb-2.5">
          <PallinoFase fase={forma} />
          <b className="truncate font-semibold text-ink">{fase.nome}</b>
          <span className="text-mute tabular-nums" data-totale-numero>
            {righe.length}
          </span>
          {onArchiviaTutte && fase.tipo === "perso" && righe.length ? (
            <button type="button" data-archivia-tutte onClick={() => onArchiviaTutte(fase, righe)} className="ml-1 rounded-md px-1.5 py-0.5 text-xs text-mute hover:bg-hover hover:text-ink">
              Archivia tutte
            </button>
          ) : null}
          <span className="ml-auto text-xs whitespace-nowrap text-ink2 tabular-nums" data-totale-valore={valore}>
            {euro(valore)}
          </span>
        </header>
        {righe.map((t) => (
          <CartaColonna key={t.id} {...datiDi(t)} />
        ))}
        {onAggiungi ? (
          <button
            type="button"
            onClick={() => onAggiungi(fase)}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-mute hover:bg-hover hover:text-ink2 [&_svg]:size-3.5"
          >
            <Plus />
            Aggiungi
          </button>
        ) : null}
      </section>
    );
  },
);
ColonnaBacheca.displayName = "ColonnaBacheca";

export const Bacheca = ({
  fasi,
  righe,
  datiDi,
  onSposta,
  onAggiungi,
  onArchiviaTutte,
  carta = Carta,
  cartaInVolo: InVolo = CartaInVolo,
}: {
  fasi: FaseRiga[];
  righe: Trattativa[];
  datiDi: (t: Trattativa) => DatiCarta;
  onSposta: (t: Trattativa, faseId: string) => void;
  onAggiungi?: (fase: FaseRiga) => void;
  onArchiviaTutte?: (fase: FaseRiga, righe: Trattativa[]) => void;
  carta?: ComponentType<DatiCarta>;
  cartaInVolo?: ComponentType<DatiCarta>;
}) => {
  const sensori = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: colonnaAccanto }),
  );
  const [inVolo, setInVolo] = useState<Trattativa | null>(null);

  const colonne = useMemo<Colonna[]>(() => {
    const perFase = new Map<string, Trattativa[]>(fasi.map((f) => [f.id, []]));
    for (const t of righe) perFase.get(t.fase_id)?.push(t);
    return fasi.map((fase) => {
      const inColonna = perFase.get(fase.id) ?? [];
      inColonna.sort((a, b) => (a.prossimo_il ?? "").localeCompare(b.prossimo_il ?? ""));
      return { fase, righe: inColonna, valore: inColonna.reduce((s, t) => s + numero(t.valore), 0) };
    });
  }, [fasi, righe]);

  const nomeDi = (id: unknown) => {
    const t = righe.find((x) => x.id === id);
    const d = t && datiDi(t);
    return d ? titoloTrattativa(d.azienda, d.persona) : "la carta";
  };
  const faseDi = (id: unknown) => fasi.find((f) => f.id === id)?.nome ?? "";
  const annunci: Announcements = {
    onDragStart: ({ active }) => `Hai preso ${nomeDi(active.id)}.`,
    onDragOver: ({ over }) => (over ? `Sopra la colonna ${faseDi(over.id)}.` : "Fuori dalle colonne."),
    onDragEnd: ({ active, over }) => (over ? `${nomeDi(active.id)} lasciata in ${faseDi(over.id)}.` : "Carta rimessa al suo posto."),
    onDragCancel: () => "Spostamento annullato.",
  };

  const inizio = ({ active }: DragStartEvent) => setInVolo((active.data.current as { t: Trattativa }).t);
  const fine = ({ active, over }: DragEndEvent) => {
    const t = (active.data.current as { t: Trattativa }).t;
    setInVolo(null);
    if (over) onSposta(t, String(over.id));
  };

  return (
    <DndContext
      sensors={sensori}
      collisionDetection={collisione}
      accessibility={{ announcements: annunci, screenReaderInstructions: ISTRUZIONI }}
      onDragStart={inizio}
      onDragEnd={fine}
      onDragCancel={() => setInVolo(null)}
    >
      <div
        data-bacheca
        className="grid flex-1 items-stretch gap-3 bg-background px-5 pt-1 pb-8"
        style={{ gridTemplateColumns: `repeat(${fasi.length}, minmax(206px, 1fr))` }}
      >
        {colonne.map((c) => (
          <ColonnaBacheca
            key={c.fase.id}
            colonna={c}
            forma={formaFase(c.fase, fasi)}
            datiDi={datiDi}
            onAggiungi={onAggiungi}
            onArchiviaTutte={onArchiviaTutte}
            carta={carta}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{inVolo ? <InVolo {...datiDi(inVolo)} /> : null}</DragOverlay>
    </DndContext>
  );
};
