import { useState } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FANTASMA } from "@/crm/viste/Barra/forme";
import type { StatoColonne } from "./useColonne";

const FRECCIA = "grid size-6 place-items-center rounded-[5px] text-mute-deco hover:bg-hover hover:text-ink disabled:opacity-30";

export const ScegliColonne = <R,>({ stato }: { stato: StatoColonne<R> }) => {
  const [cerca, setCerca] = useState("");
  const { visibili, nascoste, mostra, nascondi, sposta, ripristina, cambiata } = stato;
  const [prima, ...spostabili] = visibili;
  const altre = nascoste.filter((c) => c.etichetta.toLowerCase().includes(cerca.trim().toLowerCase()));
  return (
    <Popover>
      <PopoverTrigger className={FANTASMA} data-colonne>
        <SlidersHorizontal />
        Colonne
      </PopoverTrigger>
      <PopoverContent align="end" data-pannello-colonne className="max-h-[70vh] w-[320px] gap-2 overflow-y-auto p-3 shadow-pop">
        <ul className="flex flex-col gap-0.5">
          {prima ? (
            <li data-colonna-scelta={prima.id} className="flex items-center gap-2 rounded-[5px] py-1 pl-1">
              <input type="checkbox" className="size-3.5 accent-acc" checked disabled aria-label={`${prima.etichetta}: sempre visibile`} />
              <span className="truncate text-ink">{prima.etichetta}</span>
              <span className="ml-auto pr-1 text-xs text-mute">fissa</span>
            </li>
          ) : null}
          {spostabili.map((c, i) => (
            <li key={c.id} data-colonna-scelta={c.id} className="flex items-center gap-1 rounded-[5px] pl-1 hover:bg-hover">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1">
                <input type="checkbox" className="size-3.5 accent-acc" checked onChange={() => nascondi(c.id)} />
                <span className="truncate text-ink">{c.etichetta}</span>
              </label>
              <button type="button" aria-label={`Sposta ${c.etichetta} su`} disabled={i === 0} onClick={() => sposta(i, -1)} className={FRECCIA}>
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Sposta ${c.etichetta} giù`}
                disabled={i === spostabili.length - 1}
                onClick={() => sposta(i, 1)}
                className={FRECCIA}
              >
                <ArrowDown className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        {nascoste.length ? (
          <>
            <Input aria-label="Cerca una colonna" placeholder="Cerca una colonna" value={cerca} onChange={(e) => setCerca(e.target.value)} className="h-7" />
            <ul className="flex flex-col gap-0.5">
              {altre.map((c) => (
                <li key={c.id} data-colonna-nascosta={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-[5px] px-1 py-1 text-ink2 hover:bg-hover">
                    <input type="checkbox" className="size-3.5 accent-acc" checked={false} onChange={() => mostra(c.id)} />
                    <span className="truncate">{c.etichetta}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {cambiata ? (
          <button type="button" onClick={ripristina} className="self-start rounded-[5px] px-1 py-0.5 text-xs text-mute hover:bg-hover hover:text-ink2">
            Torna alle colonne di partenza
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
