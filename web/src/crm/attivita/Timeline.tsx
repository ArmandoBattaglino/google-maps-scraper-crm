import { useState } from "react";
import { cn } from "@/lib/utils";
import { SEGMENTI, type Soggetto, type TipoAttivita } from "./campi";
import { useLegami } from "./dati";
import { Elenco } from "./Elenco";
import { Scrivi } from "./Scrivi";

export const Timeline = (soggetto: Soggetto) => {
  const [tipo, setTipo] = useState<TipoAttivita | null>(null);
  const { legami, pronti } = useLegami(soggetto);
  const chiave = soggetto.azienda_id ?? soggetto.persona_id ?? soggetto.trattativa_id;
  return (
    <section data-timeline aria-labelledby="timeline-titolo">
      <div className="mt-[30px] mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="timeline-titolo" className="text-sm font-semibold text-ink">
          Cronologia
        </h2>
        <div role="group" aria-label="Filtra la cronologia" className="inline-flex rounded-lg bg-hover p-0.5">
          {SEGMENTI.map((s) => (
            <button
              key={s.etichetta}
              type="button"
              aria-pressed={tipo === s.tipo}
              onClick={() => setTipo(s.tipo)}
              className={cn(
                "inline-flex h-[26px] items-center rounded-md px-2.5 text-ink2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                tipo === s.tipo && "bg-background text-ink ring-1 ring-line",
              )}
            >
              {s.etichetta}
            </button>
          ))}
        </div>
      </div>
      <Scrivi key={chiave} soggetto={soggetto} legami={legami} pronti={pronti} />
      <Elenco key={`${chiave}-${tipo}`} soggetto={soggetto} tipo={tipo} />
    </section>
  );
};
