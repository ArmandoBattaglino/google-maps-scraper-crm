import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LinkBase } from "ra-core";
import { useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNomi } from "@/crm/attivita/dati";
import { chiedi } from "@/crm/chiama/api";
import { Testata } from "@/layout/Testata";
import { useOggi, voceDi, type Voce } from "./dati";
import { VoceDaFare } from "./ListaBreve";
import { diDalla } from "./PaginaOggi";
import { COLONNE, RigheElenco, type RigaCerca } from "./RigheElenco";

const PASSO = 50;

interface Risultato {
  righe: RigaCerca[];
  totale: number;
}

const useCerca = (v: Voce | null, quanti: number) =>
  useQuery({
    queryKey: [v?.risorsa ?? "nessuna", "cerca", v?.filtri, v?.ordine, quanti],
    enabled: Boolean(v),
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      chiedi<Risultato>(`/${v?.risorsa}/cerca`, {
        method: "POST",
        signal,
        body: JSON.stringify({ filtri: v?.filtri, ordine: v?.ordine, colonne: COLONNE[v?.risorsa ?? "aziende"], quanti }),
      }),
  });

export const ElencoOggi = () => {
  const { chiave = "" } = useParams();
  const [cerca] = useSearchParams();
  const di = diDalla(cerca);
  const [quanti, setQuanti] = useState(PASSO);
  const oggi = useOggi(di);
  const voce = oggi.data ? voceDi(oggi.data, chiave, cerca.get("socio"), cerca.get("tipo")) : null;
  const lista = useCerca(voce, quanti);
  const nomeDi = useNomi();
  const daFare = chiave === "da-fare" ? oggi.data?.da_fare : undefined;
  const totale = daFare ? daFare.n : lista.data?.totale;
  const indietro = di === "team" ? "/?di=team" : "/";

  return (
    <div data-pagina="oggi-elenco" data-chiave={chiave} className="pb-12">
      <Testata
        titolo={
          <span className="flex items-center gap-2">
            <LinkBase to={indietro} className="font-normal text-ink2 hover:text-ink hover:underline">
              Oggi
            </LinkBase>
            <span aria-hidden="true" className="font-normal text-mute-deco">
              /
            </span>
            {daFare ? "Da fare entro oggi" : (voce?.titolo ?? "Elenco")}
          </span>
        }
        conteggio={totale === undefined ? undefined : <span data-totale={totale}>{totale.toLocaleString("it-IT")}</span>}
      />
      {oggi.isPending || (lista.isPending && voce) ? (
        <div data-oggi-carica aria-label="Sto leggendo la lista" className="space-y-3 px-6 pt-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ) : oggi.error || lista.error ? (
        <div role="alert" className="flex items-center gap-3 px-6 pt-2 text-ink2">
          Non riesco a leggere la lista.
          <Button variant="outline" size="sm" onClick={() => void (oggi.error ? oggi.refetch() : lista.refetch())}>
            Riprova
          </Button>
        </div>
      ) : daFare ? (
        daFare.n ? (
          <>
            <ul className="border-t border-line">
              {daFare.righe.map((r) => (
                <VoceDaFare key={r.chiave} r={r} nomeDi={nomeDi} />
              ))}
            </ul>
            {daFare.n > daFare.righe.length ? (
              <p data-da-fare-oltre className="px-6 pt-3 text-cella text-mute">
                Ne vedi {daFare.righe.length.toLocaleString("it-IT")} su {daFare.n.toLocaleString("it-IT")}: le più vecchie. Chiudi queste, e arrivano le altre.
              </p>
            ) : null}
          </>
        ) : (
          <p className="px-6 pt-2 text-ink2">Qui non c'è niente adesso.</p>
        )
      ) : !voce ? (
        <p className="px-6 pt-2 text-ink2">Questa lista non esiste. Torna a Oggi e scegli un numero.</p>
      ) : !totale ? (
        <p className="px-6 pt-2 text-ink2">Qui non c'è niente adesso.</p>
      ) : (
        <>
          <RigheElenco risorsa={voce.risorsa} righe={lista.data?.righe ?? []} chiave={chiave} />
          {totale > (lista.data?.righe.length ?? 0) ? (
            <Button variant="ghost" size="sm" className="mx-4 my-1" onClick={() => setQuanti((n) => n + PASSO)}>
              Mostra altri ({(totale - (lista.data?.righe.length ?? 0)).toLocaleString("it-IT")})
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
};
