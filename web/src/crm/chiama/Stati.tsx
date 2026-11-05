import { LinkBase } from "ra-core";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ESITI } from "./Esiti";
import type { Sessione } from "./useCoda";

export const totaleSessione = (s: Sessione) => Object.values(s).reduce((a, b) => a + b, 0);
export const chiamate = (n: number) => (n === 1 ? "1 chiamata" : `${n.toLocaleString("it-IT")} chiamate`);

export const Riassunto = ({ s }: { s: Sessione }) => (
  <span className="text-mute">
    {ESITI.filter((e) => s[e.esito])
      .map((e) => `${s[e.esito]} ${e.nome.toLowerCase()}`)
      .join(", ")}
  </span>
);

export const CartaInCarica = () => (
  <div data-chiama-carica aria-label="Cerco la prossima azienda" className="space-y-4">
    <Skeleton className="h-11 w-2/3" />
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-12 w-1/2" />
  </div>
);

export const SenzaCarta = ({ in_coda, sessione, onRiprova }: { in_coda: number; sessione: Sessione; onRiprova: () => void }) => {
  const fatte = totaleSessione(sessione);
  return (
    <div data-chiama-fine={in_coda ? "prese" : "finita"} className="max-w-[56ch] py-6">
      <h1 className="text-[22px] leading-tight font-semibold text-ink">
        {in_coda ? "Le altre aziende le sta chiamando il resto del team" : "Coda finita"}
      </h1>
      <p className="mt-2 text-ink2">
        {in_coda
          ? `Ne restano ${in_coda.toLocaleString("it-IT")}, tutte già prese. Riprovo da solo ogni 20 secondi.`
          : fatte
            ? `Hai fatto ${chiamate(fatte)} in questa sessione.`
            : "Non c'è nessuno da chiamare adesso."}
      </p>
      {fatte ? (
        <p className="mt-1">
          <Riassunto s={sessione} />
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <LinkBase to="/" className={cn(buttonVariants({ variant: "default" }))}>
          Torna a Oggi
        </LinkBase>
        {in_coda ? (
          <Button variant="outline" onClick={onRiprova}>
            Riprova adesso
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export const Errore = ({ messaggio, onRiprova }: { messaggio: string; onRiprova?: () => void }) => (
  <div role="alert" data-chiama-errore className="flex flex-wrap items-center gap-3 rounded-[7px] bg-danger-soft px-3 py-2 text-danger">
    {messaggio}
    {onRiprova ? (
      <Button variant="outline" size="sm" onClick={onRiprova}>
        Riprova
      </Button>
    ) : null}
  </div>
);
