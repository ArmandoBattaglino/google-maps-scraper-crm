import { Button } from "@/components/ui/button";
import { tipoDi, type Definizione } from "./tipi";

const giorno = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("it-IT") : "");

export const ElencoArchiviati = ({
  campi,
  onRipristina,
}: {
  campi: Definizione[];
  onRipristina: (campo: Definizione) => void;
}) => {
  if (!campi.length) return null;
  return (
    <section data-sezione="archiviati" className="mt-8 px-6 pb-10">
      <h2 className="flex items-baseline gap-2 font-medium text-ink">
        Archiviati <span className="text-mute tabular-nums">{campi.length}</span>
      </h2>
      <p className="mt-0.5 text-cella text-mute">I valori restano nelle righe: ripristinando un campo tornano visibili.</p>
      <ul className="mt-2 border-t border-line2">
        {campi.map((c) => (
          <li
            key={c.id}
            data-archiviato={c.chiave}
            className="flex h-riga items-center gap-3 border-b border-line2 pl-1.5 text-cella"
          >
            <span className="min-w-0 flex-1 truncate text-ink2">{c.etichetta}</span>
            <span className="hidden w-[140px] text-mute sm:block">{tipoDi(c.tipo).nome}</span>
            <span className="hidden w-[110px] text-mute tabular-nums sm:block">{giorno(c.archiviato_il)}</span>
            <Button variant="ghost" size="sm" onClick={() => onRipristina(c)} aria-label={`Ripristina ${c.etichetta}`}>
              Ripristina
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
};
