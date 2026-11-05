import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { domani } from "@/crm/attivita/tempo";
import { DataOra } from "@/crm/DataOra";
import { istanteRoma } from "@/crm/tempo";
import { cn } from "@/lib/utils";
import type { Esito } from "./api";
import type { DataRapida } from "./quando";

export const Tasto = ({ children, className }: { children: ReactNode; className?: string }) => (
  <kbd
    className={cn(
      "inline-grid h-5 min-w-5 place-items-center rounded-[5px] border border-line bg-side px-1 text-[11px] font-medium text-ink2 not-italic tabular-nums",
      className,
    )}
  >
    {children}
  </kbd>
);

export const ESITI: { esito: Esito; nome: string; tono: string }[] = [
  { esito: "non-risponde", nome: "Non risponde", tono: "text-ink" },
  { esito: "richiamare", nome: "Da richiamare", tono: "text-esito-richiamare" },
  { esito: "non-interessato", nome: "Non interessato", tono: "text-danger" },
  { esito: "interessato", nome: "Interessato", tono: "text-esito-interessato" },
];

const Scelta = ({
  tasto,
  onClick,
  disabled,
  dati,
  children,
}: {
  tasto: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  dati?: Record<string, string>;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    {...dati}
    className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[7px] border border-line bg-background px-3 text-left font-medium outline-none hover:bg-hover focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
  >
    <Tasto className="shrink-0">{tasto}</Tasto>
    <span className="min-w-0 truncate">{children}</span>
  </button>
);

export const BarraEsiti = ({ bloccata, onEsito }: { bloccata: boolean; onEsito: (e: Esito) => void }) => (
  <div role="group" aria-label="Esito della chiamata" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
    {ESITI.map((e, i) => (
      <Scelta key={e.esito} tasto={i + 1} disabled={bloccata} dati={{ "data-esito": e.esito }} onClick={() => onEsito(e.esito)}>
        <span className={e.tono}>{e.nome}</span>
      </Scelta>
    ))}
  </div>
);

export const BarraRichiamo = ({
  date,
  bloccata,
  altraRef,
  onScegli,
  onIndietro,
}: {
  date: DataRapida[];
  bloccata: boolean;
  altraRef: React.Ref<HTMLButtonElement>;
  onScegli: (quando: string) => void;
  onIndietro: () => void;
}) => {
  const [altra, setAltra] = useState<string | null>(() => istanteRoma(domani()));
  return (
    <div data-richiamo className="space-y-2">
      <div className="flex items-center gap-2 font-medium text-ink">
        Quando la richiami?
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onIndietro}>
          <Tasto>Esc</Tasto> Indietro
        </Button>
      </div>
      <div role="group" aria-label="Quando richiamare" className="grid grid-cols-2 gap-2 lg:grid-cols-[repeat(3,1fr)_1.2fr]">
        {date.map((d, i) => (
          <Scelta key={d.chiave} tasto={i + 1} disabled={bloccata} dati={{ "data-data": d.chiave }} onClick={() => onScegli(d.quando)}>
            {d.etichetta} <span className="font-normal text-mute">{d.dettaglio}</span>
          </Scelta>
        ))}
        <form
          className="flex h-12 items-center gap-2 rounded-[7px] border border-line px-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (altra) onScegli(altra);
          }}
        >
          <Tasto className="shrink-0">4</Tasto>
          <DataOra bottoneRef={altraRef} etichetta="Un altro giorno e un'altra ora" svuotabile={false} valore={altra} onCambia={setAltra} className="h-7 min-w-0 flex-1 border-0 px-1 shadow-none" />
          <Button type="submit" size="sm" variant="outline" disabled={bloccata}>
            Salva
          </Button>
        </form>
      </div>
    </div>
  );
};
