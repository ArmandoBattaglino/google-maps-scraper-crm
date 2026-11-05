import { createContext, memo, useContext, type MouseEvent } from "react";
import { AzioniRiga } from "@/crm/azioni/MenuRiga";
import { useDraggable } from "@dnd-kit/core";
import { LinkBase } from "ra-core";
import { useNavigate } from "react-router";
import { ChipSocio } from "@/components/crm/forme";
import type { DatiCarta } from "@/crm/trattative/Carta";
import { cn } from "@/lib/utils";
import { colonneTitolo, titoloDi } from "../Calendario/eventi";
import { eSocio, useContesto } from "../contesto";
import type { RigaVista } from "../dati";
import { testoValore, valoreDi } from "../formato";
import { schedaDi } from "../Tabella/Mostra";

export const ColonneCarta = createContext<string[]>([]);

const CLASSI = "rounded-lg border border-line bg-background p-3 shadow-carta";
const MAX_RIGHE = 3;

const Dentro = ({ riga }: { riga: RigaVista }) => {
  const ctx = useContesto();
  const colonne = useContext(ColonneCarta);
  const titolo = titoloDi(ctx.risorsa, riga);
  const scheda = schedaDi(ctx.risorsa, riga);
  const titoli = new Set(colonneTitolo(ctx.risorsa));
  const altre = colonne
    .filter((c) => !titoli.has(c))
    .map((c) => ({ c, testo: testoValore(ctx, c, valoreDi(riga, c)) }))
    .filter((x) => x.testo)
    .slice(0, MAX_RIGHE);
  return (
    <>
      <h4 className="truncate font-medium text-ink">
        {scheda ? (
          <LinkBase to={scheda} draggable={false} className="hover:underline hover:underline-offset-3">
            {titolo}
          </LinkBase>
        ) : (
          titolo
        )}
      </h4>
      {altre.map((x) => (
        <p key={x.c} className="mt-0.5 flex items-center gap-1.5 text-xs">
          <span className="shrink-0 text-mute">{ctx.nome(x.c)}</span>
          {eSocio(x.c, valoreDi(riga, x.c)) ? <ChipSocio nome={x.testo} /> : <span className="min-w-0 truncate text-ink2">{x.testo}</span>}
        </p>
      ))}
    </>
  );
};

export const CartaRiga = memo(({ t }: DatiCarta) => {
  const riga = t as unknown as RigaVista;
  const ctx = useContesto();
  const navigate = useNavigate();
  const azioni = useContext(AzioniRiga);
  const perMenu = { id: t.id, nome: String(riga.nome ?? ""), archiviata_il: riga.archiviata_il };
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: t.id,
    data: { t },
    attributes: { roleDescription: "carta da spostare" },
  });
  const apri = (e: MouseEvent) => {
    const scheda = schedaDi(ctx.risorsa, riga);
    if (scheda && !(e.target as HTMLElement).closest("a")) navigate(scheda);
  };
  return (
    <article
      ref={(n) => {
        setNodeRef(n);
        setActivatorNodeRef(n);
      }}
      data-carta={t.id}
      onContextMenu={azioni ? (e) => azioni(e, perMenu) : undefined}
      onClick={apri}
      {...attributes}
      {...listeners}
      className={cn(
        CLASSI,
        "mb-2 cursor-grab outline-none select-none [contain-intrinsic-size:auto_70px] [content-visibility:auto] hover:border-line-strong focus-visible:ring-3 focus-visible:ring-ring/50",
        isDragging && "opacity-40",
      )}
    >
      <Dentro riga={riga} />
    </article>
  );
});
CartaRiga.displayName = "CartaRiga";

export const CartaRigaInVolo = ({ t }: DatiCarta) => (
  <div className={cn(CLASSI, "w-full cursor-grabbing shadow-pop select-none")}>
    <Dentro riga={t as unknown as RigaVista} />
  </div>
);
