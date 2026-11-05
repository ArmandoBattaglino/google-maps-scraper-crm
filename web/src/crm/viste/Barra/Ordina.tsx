import { ArrowUpDown, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Scelta } from "@/crm/Scelta";
import { Segmenti } from "@/crm/Segmenti";
import { useContesto } from "../contesto";
import { gruppiPerScelta } from "../gruppiCampi";
import type { Ordine } from "../stato";
import { FANTASMA } from "./forme";

const MAX_ORDINI = 5;

export const Ordina = ({ ordine, onCambia }: { ordine: Ordine[]; onCambia: (o: Ordine[]) => void }) => {
  const ctx = useContesto();
  const voci = ctx.campi.filter((c) => c.ordinabile);
  const gruppi = gruppiPerScelta(voci.map((c) => c.campo), ctx.nome, ctx.risorsa);
  const liberi = voci.filter((c) => !ordine.some((o) => o.campo === c.campo));
  const cambiaUno = (i: number, nuovo: Ordine) => onCambia(ordine.map((o, k) => (k === i ? nuovo : o)));
  return (
    <Popover>
      <PopoverTrigger className={FANTASMA} data-ordina>
        <ArrowUpDown />
        {ordine[0] ? (
          <span>
            Ordina: <b>{ctx.nome(ordine[0].campo)}</b>
            {ordine.length > 1 ? ` e altri ${ordine.length - 1}` : ""}
          </span>
        ) : (
          "Ordina"
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] gap-2 p-3 shadow-pop">
        {ordine.map((o, i) => (
          <div key={o.campo} data-ordine={o.campo} className="flex items-center gap-1.5">
            <Scelta etichetta="Campo" valore={o.campo} gruppi={gruppi} onScegli={(campo) => cambiaUno(i, { ...o, campo })} className="h-7 w-[160px] min-w-0" />
            <Segmenti
              etichetta="Verso"
              valore={o.dir}
              onScegli={(dir) => cambiaUno(i, { ...o, dir })}
              opzioni={[
                { valore: "asc", etichetta: "Crescente" },
                { valore: "desc", etichetta: "Decrescente" },
              ]}
            />
            <button
              type="button"
              aria-label={`Togli l'ordinamento ${ctx.nome(o.campo)}`}
              onClick={() => onCambia(ordine.filter((_, k) => k !== i))}
              className="ml-auto grid size-6 place-items-center rounded-[5px] text-mute-deco hover:bg-hover hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {!ordine.length ? <p className="text-mute">Senza ordinamento le righe seguono l'ordine in cui sono state create.</p> : null}
        {ordine.length < MAX_ORDINI && liberi[0] ? (
          <button type="button" className={`${FANTASMA} self-start`} onClick={() => onCambia([...ordine, { campo: liberi[0].campo, dir: "asc" }])}>
            <Plus />
            Ordinamento
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
