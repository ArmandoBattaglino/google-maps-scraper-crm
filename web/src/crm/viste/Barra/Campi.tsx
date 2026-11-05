import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Scelta } from "@/crm/Scelta";
import { cn } from "@/lib/utils";
import { useContesto } from "../contesto";
import { corrisponde, gruppoDi, inGruppi } from "../gruppiCampi";
import type { Colonna } from "../stato";
import { FANTASMA, NESSUNO } from "./forme";

const MAX_COLONNE = 60;
const NOMI_TOTALE: Record<string, string> = { somma: "Somma", media: "Media", min: "Minimo", max: "Massimo" };
const FRECCIA = "grid size-6 shrink-0 place-items-center rounded-[5px] text-mute-deco hover:bg-hover hover:text-ink disabled:opacity-30";

export const Campi = ({ colonne, onCambia }: { colonne: Colonna[]; onCambia: (c: Colonna[]) => void }) => {
  const ctx = useContesto();
  const [cerca, setCerca] = useState("");
  const casella = useRef<HTMLInputElement>(null);
  const trovato = (campo: string) => corrisponde(ctx.nome(campo), gruppoDi(campo, ctx.risorsa), cerca);
  const scelte = new Set(colonne.map((c) => c.campo));
  const attive = colonne.filter((c) => trovato(c.campo));
  const gruppi = inGruppi(
    ctx.campi.filter((c) => !scelte.has(c.campo) && trovato(c.campo)),
    (c) => c.campo,
    ctx.risorsa,
  );
  const sposta = (campo: string, vicina: string) => {
    const copia = [...colonne];
    const da = copia.findIndex((c) => c.campo === campo);
    const a = copia.findIndex((c) => c.campo === vicina);
    copia.splice(a, 0, ...copia.splice(da, 1));
    onCambia(copia);
  };
  return (
    <Popover
      onOpenChange={(aperto, dettagli) => {
        if (aperto) return;
        if (dettagli.reason === "escape-key" && cerca) dettagli.cancel();
        setCerca("");
      }}
    >
      <PopoverTrigger className={FANTASMA} data-campi>
        <SlidersHorizontal />
        Campi
      </PopoverTrigger>
      <PopoverContent align="end" data-pannello-campi className="max-h-[70vh] w-[400px] gap-0 overflow-hidden p-0 shadow-pop">
        <div data-cerca-campi className="relative shrink-0 border-b border-line p-2">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-mute-deco" />
          <Input
            ref={casella}
            aria-label="Cerca un campo"
            placeholder="Cerca un campo"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            className={cn("h-7 pl-7", cerca && "pr-7")}
          />
          {cerca ? (
            <button
              type="button"
              aria-label="Svuota la ricerca"
              onClick={() => {
                setCerca("");
                casella.current?.focus();
              }}
              className="absolute top-1/2 right-3 grid size-5 -translate-y-1/2 place-items-center rounded-[5px] text-mute-deco hover:bg-hover hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div data-elenco-campi className="min-h-0 overflow-y-auto p-2">
          {attive.length ? (
            <section aria-label="Colonne attive" data-colonne-attive>
              <h3 className="px-2 pb-1 text-xs font-medium text-mute">Colonne attive</h3>
              <ul className="flex flex-col gap-0.5">
                {attive.map((c, k) => {
                  const totali = (ctx.voce(c.campo)?.totali ?? []).filter((t) => t !== "count");
                  const gruppo = gruppoDi(c.campo, ctx.risorsa);
                  return (
                    <li key={c.campo} data-colonna-scelta={c.campo} className="flex items-center gap-1 rounded-[5px] pl-2 hover:bg-hover">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1">
                        <input type="checkbox" className="size-3.5 shrink-0 accent-acc" checked onChange={() => onCambia(colonne.filter((x) => x.campo !== c.campo))} />
                        <span className="truncate text-ink">{ctx.nome(c.campo)}</span>
                        {gruppo.chiave !== ctx.risorsa ? (
                          <span
                            data-entita-colonna={gruppo.chiave}
                            title={gruppo.breve}
                            className="flex shrink-0 items-center gap-1 text-xs text-mute [&_svg]:size-3 [&_svg]:text-mute-deco"
                          >
                            <gruppo.icona />
                            {}
                            {ctx.nome(c.campo) === gruppo.breve ? null : gruppo.breve}
                          </span>
                        ) : null}
                      </label>
                      {totali.length ? (
                        <Scelta
                          etichetta={`Totale di ${ctx.nome(c.campo)}`}
                          valore={c.totale ?? NESSUNO}
                          opzioni={[{ valore: NESSUNO, etichetta: "Senza totale" }, ...totali.map((t) => ({ valore: t, etichetta: NOMI_TOTALE[t] ?? t }))]}
                          onScegli={(t) => onCambia(colonne.map((x) => (x.campo === c.campo ? { campo: x.campo, ...(t === NESSUNO ? {} : { totale: t }) } : x)))}
                          className="w-[112px] shrink-0 border-transparent text-xs text-ink2 data-[size=default]:h-6"
                        />
                      ) : null}
                      <button type="button" aria-label={`Sposta ${ctx.nome(c.campo)} su`} disabled={k === 0} onClick={() => sposta(c.campo, attive[k - 1].campo)} className={FRECCIA}>
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Sposta ${ctx.nome(c.campo)} giù`}
                        disabled={k === attive.length - 1}
                        onClick={() => sposta(c.campo, attive[k + 1].campo)}
                        className={FRECCIA}
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {gruppi.map(({ gruppo, voci }, i) => (
            <section
              key={gruppo.chiave}
              data-gruppo-entita={gruppo.chiave}
              aria-label={gruppo.nome}
              className={cn("pt-2", (i > 0 || attive.length > 0) && "mt-2 border-t border-line")}
            >
              <h3 className="flex items-center gap-1.5 px-2 pb-1 text-sm font-semibold text-ink [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-ink2">
                <gruppo.icona />
                {gruppo.nome}
              </h3>
              <ul className="flex flex-col gap-0.5">
                {voci.map((c) => (
                  <li key={c.campo} data-campo-altro={c.campo}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-[5px] py-1 pr-2 pl-7 text-ink2 hover:bg-hover">
                      <input
                        type="checkbox"
                        className="size-3.5 shrink-0 accent-acc"
                        checked={false}
                        disabled={colonne.length >= MAX_COLONNE}
                        onChange={() => onCambia([...colonne, { campo: c.campo }])}
                      />
                      <span className="truncate">{ctx.nome(c.campo)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!attive.length && !gruppi.length ? <p className="px-2 py-3 text-center text-mute">Nessun campo con «{cerca.trim()}».</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
};
