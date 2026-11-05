import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { useNavigate } from "react-router";
import { Archive, ArchiveRestore, ExternalLink, MoreHorizontal, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatiCrm } from "@/providers/dati";

export type RisorsaAzioni = "trattative" | "aziende" | "persone";

export interface RigaAzioni {
  id: string;
  nome?: string;
  archiviata_il?: unknown;
}

export const AzioniRiga = createContext<((e: MouseEvent, riga: RigaAzioni) => void) | null>(null);

const messaggio = (e: unknown) => (e instanceof Error && e.message ? e.message : "errore del servizio");

const ChiudiMenu = createContext<() => void>(() => undefined);

const VOCE = "flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-ink2 outline-none hover:bg-hover hover:text-ink focus-visible:bg-hover [&_svg]:size-3.5";

export const VoceMenu = ({ icona, testo, onClick, ferma, pericolo, href }: { icona: ReactNode; testo: string; onClick?: () => void; ferma?: string; pericolo?: boolean; href?: string }) => {
  const chiudi = useContext(ChiudiMenu);
  if (href) {
    return (
      <a
        role="menuitem"
        href={href}
        onClick={(e) => {
          e.stopPropagation();
          chiudi();
        }}
        className={VOCE}
      >
        {icona}
        {testo}
      </a>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      disabled={!!ferma}
      title={ferma}
      onClick={(e) => {
        e.stopPropagation();
        chiudi();
        onClick?.();
      }}
      className={cn(VOCE, pericolo && "text-danger hover:text-danger", ferma && "cursor-not-allowed opacity-50 hover:bg-transparent")}
    >
      {icona}
      {testo}
    </button>
  );
};

export const useMenu = <R,>() => {
  const [menu, setMenu] = useState<{ x: number; y: number; riga: R } | null>(null);
  const contenitore = useRef<HTMLDivElement>(null);
  const daRidare = useRef<HTMLElement | null>(null);
  const [posto, setPosto] = useState({ left: 0, top: 0 });

  const apri = useCallback((e: MouseEvent, riga: R) => {
    e.preventDefault();
    e.stopPropagation();
    daRidare.current = document.activeElement as HTMLElement | null;
    const daTastiera = e.clientX === 0 && e.clientY === 0;
    const b = e.currentTarget.getBoundingClientRect();
    setMenu({ x: daTastiera ? b.left : e.clientX, y: daTastiera ? b.bottom : e.clientY, riga });
  }, []);
  const chiudi = useCallback(() => setMenu(null), []);

  useLayoutEffect(() => {
    if (!menu || !contenitore.current) return;
    const r = contenitore.current.getBoundingClientRect();
    setPosto({
      left: Math.min(menu.x, window.innerWidth - r.width - 8),
      top: Math.min(menu.y, window.innerHeight - r.height - 8),
    });
    contenitore.current.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const fuori = (e: globalThis.MouseEvent) => {
      if (!contenitore.current?.contains(e.target as Node)) chiudi();
    };
    const tasto = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      daRidare.current?.focus();
      chiudi();
    };
    window.addEventListener("mousedown", fuori);
    window.addEventListener("keydown", tasto, true);
    window.addEventListener("scroll", chiudi, true);
    return () => {
      window.removeEventListener("mousedown", fuori);
      window.removeEventListener("keydown", tasto, true);
      window.removeEventListener("scroll", chiudi, true);
    };
  }, [menu, chiudi]);

  const disegna = (voci: ReactNode) =>
    menu
      ? createPortal(
          <div
            ref={contenitore}
            role="menu"
            aria-label="Azioni"
            data-menu-riga
            style={posto}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            className="fixed z-50 w-[190px] rounded-lg border border-line bg-background p-1 text-cella shadow-pop"
          >
            <ChiudiMenu.Provider value={chiudi}>{voci}</ChiudiMenu.Provider>
          </div>,
          document.body,
        )
      : null;

  return { apri, riga: menu?.riga ?? null, disegna };
};

export const menuAperto = () => document.querySelector("[data-menu-riga]") !== null;

export const useAzioniRiga = (risorsa: RisorsaAzioni) => {
  const navigate = useNavigate();
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const { apri, riga, disegna } = useMenu<RigaAzioni>();

  const rileggi = () => qc.invalidateQueries({ queryKey: [risorsa] });

  const archivia = async (r: RigaAzioni) => {
    try {
      await dp.archivia(risorsa, { id: r.id });
      notify(`Archiviata: si ritrova nelle Viste, togliendo il filtro «archiviata»`, { type: "info" });
    } catch (e) {
      notify(`Non archiviata: ${messaggio(e)}`, { type: "error" });
    }
    await rileggi();
  };
  const riprendi = async (r: RigaAzioni) => {
    try {
      await dp.riprendi(risorsa, { id: r.id });
    } catch (e) {
      notify(`Non ripresa: ${messaggio(e)}`, { type: "error" });
    }
    await rileggi();
  };

  const scheda = (r: RigaAzioni) => `/${risorsa}/${r.id}`;

  const nodo = disegna(
    riga ? (
      <>
        <VoceMenu icona={<ExternalLink />} testo="Apri" onClick={() => navigate(scheda(riga))} />
        <VoceMenu icona={<Pencil />} testo="Modifica" onClick={() => navigate(risorsa === "persone" ? `/persone/${riga.id}/modifica` : scheda(riga))} />
        {riga.archiviata_il ? (
          <VoceMenu icona={<ArchiveRestore />} testo="Riprendi" onClick={() => void riprendi(riga)} />
        ) : (
          <VoceMenu
            icona={<Archive />}
            testo="Archivia"
            ferma={risorsa === "aziende" ? "Le aziende non si archiviano ancora" : undefined}
            onClick={() => void archivia(riga)}
          />
        )}
      </>
    ) : null,
  );
  return { apri, nodo };
};

export const TestataPuntini = ({ sopra }: { sopra: string }) => <th aria-label="Azioni" className={cn("sticky right-0 z-[2] w-0 border-b border-line bg-background p-0", sopra)} />;

export const CellaPuntini = ({ onApri }: { onApri?: (e: MouseEvent) => void }) => (
  <td className="sticky right-0 z-[1] w-0 border-b border-line2 p-0">
    {onApri ? (
      <div className="relative">
        <TrePuntini className="absolute top-1/2 right-1 -translate-y-1/2 shadow-pop" onApri={onApri} />
      </div>
    ) : null}
  </td>
);

export const TrePuntini = ({ onApri, className }: { onApri: (e: MouseEvent) => void; className?: string }) => (
  <button
    type="button"
    aria-label="Azioni"
    aria-haspopup="menu"
    data-tre-puntini
    draggable={false}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      onApri(e);
    }}
    className={cn(
      "grid size-6 place-items-center rounded-md bg-background text-mute opacity-0 outline-none hover:bg-hover hover:text-ink focus-visible:opacity-100 [article:hover_&]:opacity-100 [tr:hover_&]:opacity-100 [&_svg]:size-4",
      className,
    )}
  >
    <MoreHorizontal />
  </button>
);
