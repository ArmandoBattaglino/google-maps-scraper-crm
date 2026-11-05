import { useState } from "react";
import { useNotify } from "ra-core";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Testata } from "@/layout/Testata";
import { cn } from "@/lib/utils";
import { ElencoArchiviati } from "./ElencoArchiviati";
import { ElencoCampi } from "./ElencoCampi";
import { PannelloCampo } from "./PannelloCampo";
import { useCampi } from "./useCampi";
import { erroreDi, OGGETTI, type Definizione, type Oggetto } from "./tipi";

const NUOVO = "nuovo";

const SceltaOggetto = ({
  oggetto,
  conteggi,
  onCambia,
}: {
  oggetto: Oggetto;
  conteggi: Record<string, number>;
  onCambia: (o: Oggetto) => void;
}) => (
  <div role="group" aria-label="Oggetto" className="inline-flex rounded-lg bg-hover p-0.5">
    {OGGETTI.map((o) => (
      <button
        key={o.id}
        type="button"
        aria-pressed={o.id === oggetto}
        data-oggetto={o.id}
        onClick={() => onCambia(o.id)}
        className={cn(
          "inline-flex h-[26px] items-center gap-1.5 rounded-[6px] px-2.5 outline-none focus-visible:ring-3 focus-visible:ring-acc-soft",
          o.id === oggetto ? "bg-background text-ink shadow-seg" : "text-ink2",
        )}
      >
        {o.nome}
        <span className="text-xs text-mute tabular-nums">{conteggi[o.id] ?? 0}</span>
      </button>
    ))}
  </div>
);

export const CampiGestione = () => {
  const [parametri, setParametri] = useSearchParams();
  const voce = OGGETTI.find((o) => o.id === parametri.get("oggetto")) ?? OGGETTI[0];
  const campi = useCampi(voce.id);
  const notify = useNotify();
  const [aperto, setAperto] = useState<string | null>(null);

  const scelto = campi.attivi.find((c) => c.id === aperto);
  const pannello = aperto === NUOVO || scelto;

  const cambiaOggetto = (o: Oggetto) => {
    setAperto(null);
    setParametri({ oggetto: o });
  };

  const prova = (fai: (c: Definizione) => Promise<void>) => (c: Definizione) => {
    fai(c).catch((e) => notify(erroreDi(e).messaggio, { type: "error" }));
  };

  return (
    <div
      data-pagina="campi"
      className={cn("grid min-h-full grid-cols-1", pannello && "lg:grid-cols-[minmax(0,1fr)_340px]")}
    >
      <div className="min-w-0">
        <Testata
          titolo="Campi personalizzati"
          conteggio={campi.isPending ? undefined : campi.attivi.length}
          azioni={
            <Button onClick={() => setAperto(NUOVO)}>
              <Plus />
              Nuovo campo
            </Button>
          }
        />
        <div className="flex flex-wrap items-center gap-3 px-6 pb-3">
          <SceltaOggetto oggetto={voce.id} conteggi={campi.conteggi} onCambia={cambiaOggetto} />
          {campi.attivi.length > 1 ? (
            <p className="text-cella text-mute">Trascina dalla maniglia per cambiare l'ordine nella scheda.</p>
          ) : null}
        </div>

        {campi.isPending ? (
          <p role="status" aria-label="Carico i campi" className="animate-pulse px-6 py-4 text-mute">
            ...
          </p>
        ) : campi.error ? (
          <div role="alert" className="mx-6 mt-2 rounded-md bg-danger-soft px-3 py-2.5 text-danger">
            <p>I campi non si sono caricati: {erroreDi(campi.error).messaggio}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void campi.refetch()}>
              Riprova
            </Button>
          </div>
        ) : campi.attivi.length ? (
          <div className="px-4">
            <ElencoCampi
              campi={campi.attivi}
              scelto={scelto?.id}
              onApri={(c) => setAperto(c.id)}
              onRiordina={(l) => void campi.riordina(l)}
              onArchivia={prova(campi.archivia)}
            />
          </div>
        ) : (
          <section data-vuota className="mx-6 mt-2 max-w-[560px] rounded-lg border border-dashed border-line p-5">
            <p className="font-medium text-ink">Nessun campo {voce.dette}.</p>
            <p className="mt-1 text-ink2">
              Un campo vale per {voce.riga}: compare nella scheda, come colonna nelle liste e nei filtri.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setAperto(NUOVO)}>
              <Plus />
              Nuovo campo
            </Button>
          </section>
        )}

        <ElencoArchiviati campi={campi.archiviati} onRipristina={prova(campi.ripristina)} />
      </div>
      {pannello ? (
        <PannelloCampo key={`${voce.id}:${aperto}`} campo={scelto} campi={campi} onChiudi={() => setAperto(null)} />
      ) : null}
    </div>
  );
};
