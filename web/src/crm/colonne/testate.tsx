import { useCallback, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";

export const LARGHEZZA_MINIMA = 64;

const nomeVariabile = (chiave: string) => `--colonna-${chiave.replace(/[^a-zA-Z0-9]/g, "_")}`;

export const stileColonna = (chiave: string, tetto = "280px"): CSSProperties => {
  const v = `var(${nomeVariabile(chiave)}`;
  return { width: `${v}, auto)`, minWidth: `${v}, 0)`, maxWidth: `${v}, ${tetto})` };
};

export const larghezzeTabella = (colonne: { chiave: string; larghezza?: number }[]): CSSProperties =>
  Object.fromEntries(colonne.filter((c) => c.larghezza).map((c) => [nomeVariabile(c.chiave), `${c.larghezza}px`])) as CSSProperties;

export const ManigliaLarghezza = ({
  chiave,
  nome,
  onLarghezza,
}: {
  chiave: string;
  nome: string;
  onLarghezza: (larghezza: number | undefined) => void;
}) => {
  const giu = (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const maniglia = e.currentTarget;
    const testata = maniglia.closest("th");
    const tabella = maniglia.closest("table");
    if (!testata || !tabella) return;
    const partenza = e.clientX;
    const prima = testata.getBoundingClientRect().width;
    let adesso = Math.round(prima);
    maniglia.setPointerCapture(e.pointerId);
    const muovi = (m: globalThis.PointerEvent) => {
      adesso = Math.max(LARGHEZZA_MINIMA, Math.round(prima + m.clientX - partenza));
      tabella.style.setProperty(nomeVariabile(chiave), `${adesso}px`);
    };
    const su = () => {
      maniglia.removeEventListener("pointermove", muovi);
      maniglia.removeEventListener("pointerup", su);
      maniglia.removeEventListener("pointercancel", su);
      if (adesso !== Math.round(prima)) onLarghezza(adesso);
    };
    maniglia.addEventListener("pointermove", muovi);
    maniglia.addEventListener("pointerup", su);
    maniglia.addEventListener("pointercancel", su);
  };
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Larghezza della colonna"
      title={`Larghezza di ${nome}: trascina, due clic per quella automatica`}
      data-maniglia={chiave}
      draggable
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        e.currentTarget.closest("table")?.style.removeProperty(nomeVariabile(chiave));
        onLarghezza(undefined);
      }}
      onPointerDown={giu}
      className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize touch-none after:absolute after:top-1/4 after:right-0 after:bottom-1/4 after:w-px after:bg-transparent hover:after:bg-line-strong"
    />
  );
};

const TIPO = "text/x-colonna-crm";

export const useSpostaColonne = (chiavi: string[], onOrdine: (chiavi: string[]) => void) => {
  const [sopra, setSopra] = useState<{ chiave: string; dopo: boolean } | null>(null);
  const finisci = useCallback(() => setSopra(null), []);

  const propsDi = (chiave: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(TIPO, chiave);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!e.dataTransfer.types.includes(TIPO)) return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      setSopra({ chiave, dopo: e.clientX > r.left + r.width / 2 });
    },
    onDragLeave: finisci,
    onDragEnd: finisci,
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      const presa = e.dataTransfer.getData(TIPO);
      const r = e.currentTarget.getBoundingClientRect();
      const dopo = e.clientX > r.left + r.width / 2;
      setSopra(null);
      if (!presa || presa === chiave) return;
      const senza = chiavi.filter((c) => c !== presa);
      senza.splice(senza.indexOf(chiave) + (dopo ? 1 : 0), 0, presa);
      onOrdine(senza);
    },
  });
  const segnoDi = (chiave: string): string | undefined =>
    sopra?.chiave !== chiave
      ? undefined
      : sopra.dopo
        ? "shadow-[inset_-2px_0_0_0_var(--acc)]"
        : "shadow-[inset_2px_0_0_0_var(--acc)]";
  return { propsDi, segnoDi };
};
