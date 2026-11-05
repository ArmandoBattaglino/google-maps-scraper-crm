import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmenti } from "@/crm/Segmenti";
import { Testata } from "@/layout/Testata";
import { cn } from "@/lib/utils";
import { ChiHaFatto } from "./ChiHaFatto";
import { useOggi, type Di } from "./dati";
import { ListeBrevi } from "./ListaBreve";
import { Numeri } from "./Numeri";

const DI = [
  { valore: "me" as const, etichetta: "Miei" },
  { valore: "team" as const, etichetta: "Del team" },
];

export const diDalla = (cerca: URLSearchParams): Di => (cerca.get("di") === "team" ? "team" : "me");

const Carica = () => (
  <div data-oggi-carica aria-label="Sto leggendo i numeri di oggi" className="border-y border-line px-6 py-4">
    <div className="grid grid-cols-4 gap-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-16" />
        </div>
      ))}
    </div>
  </div>
);

const giornoDiOggi = () =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(new Date());

export const PaginaOggi = () => {
  const [cerca, setCerca] = useSearchParams();
  const di = diDalla(cerca);
  const { data, isPending, isPlaceholderData, error, refetch } = useOggi(di);

  return (
    <div data-pagina="oggi" className="pb-12">
      <Testata
        titolo="Oggi"
        conteggio={giornoDiOggi()}
        azioni={
          <Segmenti
            etichetta="Di chi sono i numeri"
            opzioni={DI}
            valore={di}
            onScegli={(v) => setCerca(v === "team" ? { di: "team" } : {})}
          />
        }
      />
      {isPending ? (
        <Carica />
      ) : error && !data ? (
        <div role="alert" data-oggi-errore className="flex items-center gap-3 px-6 pt-2 text-ink2">
          Non riesco a leggere i numeri di oggi.
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Riprova
          </Button>
        </div>
      ) : data ? (
        <div aria-busy={isPlaceholderData} className={cn(isPlaceholderData && "opacity-60")}>
          <Numeri o={data} di={di} />
          <div className="grid lg:grid-cols-[minmax(0,1fr)_480px]">
            <ListeBrevi o={data} di={di} />
            <ChiHaFatto o={data} di={di} />
          </div>
        </div>
      ) : null}
    </div>
  );
};
