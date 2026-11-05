import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Scelta } from "@/crm/Scelta";
import { Segmenti } from "@/crm/Segmenti";
import { cn } from "@/lib/utils";
import { useContesto } from "../contesto";
import { nomeOperatore } from "../etichette";
import { gruppiPerScelta } from "../gruppiCampi";
import { FANTASMA } from "../Barra/forme";
import type { Condizione, Gruppo, Nodo } from "../stato";
import { aggiungi, cambiaLegame, eGruppo, figli, legame, MAX_PROFONDITA, pulisci, sostituisci } from "./albero";
import { ValoreFiltro } from "./ValoreFiltro";

const VUOTA: Condizione = { campo: "", op: "" };
const TOGLI = "grid size-6 shrink-0 place-items-center rounded-[5px] text-mute-deco hover:bg-hover hover:text-ink";

const RigaCondizione = ({ c, onCambia, onTogli }: { c: Condizione; onCambia: (c: Condizione) => void; onTogli: () => void }) => {
  const ctx = useContesto();
  const voce = ctx.voce(c.campo);
  const fuoriMenu = c.campo && !ctx.campi.some((x) => x.campo === c.campo) ? [{ valore: c.campo, etichetta: ctx.nome(c.campo) }] : [];
  const gruppiCampo = gruppiPerScelta(ctx.campi.map((x) => x.campo), ctx.nome, ctx.risorsa);
  return (
    <div data-condizione className="grid grid-cols-[150px_130px_minmax(170px,1fr)_24px] items-start gap-1.5">
      <Scelta
        etichetta="Campo"
        valore={c.campo || null}
        vuoto="Campo"
        opzioni={fuoriMenu}
        gruppi={gruppiCampo}
        className="h-7 w-full min-w-0"
        onScegli={(campo) => onCambia({ campo, op: ctx.voce(campo)?.operatori[0] ?? "" })}
      />
      <Scelta
        etichetta="Operatore"
        valore={c.op || null}
        vuoto="Operatore"
        disabilitata={!voce}
        opzioni={(voce?.operatori ?? []).map((op) => ({ valore: op, etichetta: nomeOperatore(op, voce?.tipo) }))}
        className="h-7 w-full min-w-0"
        onScegli={(op) => onCambia({ campo: c.campo, op })}
      />
      <div className="min-w-0">
        <ValoreFiltro campo={c.campo} op={c.op} valore={c.valore} onCambia={(valore) => onCambia({ ...c, valore })} />
      </div>
      <button type="button" aria-label="Togli la condizione" onClick={onTogli} className={TOGLI}>
        <X className="size-3.5" />
      </button>
    </div>
  );
};

const GruppoFiltri = ({
  gruppo,
  profondita,
  onCambia,
  onTogli,
}: {
  gruppo: Gruppo;
  profondita: number;
  onCambia: (g: Gruppo) => void;
  onTogli?: () => void;
}) => (
  <div data-gruppo-filtri={legame(gruppo)} className={cn("flex flex-col gap-2", profondita > 1 && "rounded-lg border border-line bg-side p-2.5")}>
    <div className="flex items-center gap-2">
      <Segmenti
        etichetta="Come si legano"
        valore={legame(gruppo)}
        onScegli={(l) => onCambia(cambiaLegame(gruppo, l))}
        opzioni={[
          { valore: "e", etichetta: "Tutte" },
          { valore: "o", etichetta: "Almeno una" },
        ]}
      />
      {onTogli ? (
        <button type="button" aria-label="Togli il gruppo" onClick={onTogli} className={cn(TOGLI, "ml-auto")}>
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
    {figli(gruppo).map((n: Nodo, i) =>
      eGruppo(n) ? (
        <GruppoFiltri
          key={i}
          gruppo={n}
          profondita={profondita + 1}
          onCambia={(g) => onCambia(sostituisci(gruppo, [i], g))}
          onTogli={() => onCambia(sostituisci(gruppo, [i], null))}
        />
      ) : (
        <RigaCondizione
          key={i}
          c={n}
          onCambia={(c) => onCambia(sostituisci(gruppo, [i], c))}
          onTogli={() => onCambia(sostituisci(gruppo, [i], null))}
        />
      ),
    )}
    <div className="flex items-center gap-1">
      <button type="button" className={FANTASMA} onClick={() => onCambia(aggiungi(gruppo, [], VUOTA))}>
        <Plus />
        Condizione
      </button>
      {profondita < MAX_PROFONDITA - 1 ? (
        <button type="button" className={FANTASMA} onClick={() => onCambia(aggiungi(gruppo, [], { o: [VUOTA] }))}>
          <Plus />
          Gruppo
        </button>
      ) : null}
    </div>
  </div>
);

export const Costruttore = ({
  filtri,
  onCambia,
  aperto,
  onAperto,
}: {
  filtri: Gruppo;
  onCambia: (f: Gruppo) => void;
  aperto: boolean;
  onAperto: (a: boolean) => void;
}) => {
  const [bozza, setBozza] = useState<Gruppo>(filtri);
  const [eraAperto, setEraAperto] = useState(false);
  if (aperto !== eraAperto) {
    setEraAperto(aperto);
    if (aperto) setBozza(figli(filtri).length ? filtri : { e: [VUOTA] });
  }
  return (
    <Popover open={aperto} onOpenChange={onAperto}>
      <PopoverTrigger className={FANTASMA}>
        <Plus />
        Filtro
      </PopoverTrigger>
      <PopoverContent align="start" data-costruttore className="max-h-[70vh] w-[600px] gap-2 overflow-y-auto p-3 shadow-pop">
        <GruppoFiltri
          gruppo={bozza}
          profondita={1}
          onCambia={(g) => {
            setBozza(g);
            onCambia(pulisci(g));
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
