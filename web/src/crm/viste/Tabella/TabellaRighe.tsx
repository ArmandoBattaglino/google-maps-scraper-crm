import { useEffect, useRef } from "react";
import { messaggioDi } from "../Barra/forme";
import { colonneDi, haFiltri, useRighe } from "../dati";
import { pulisci } from "../Filtri/albero";
import { Errore, Puntini, Vuoto } from "../forme";
import type { StatoPagina } from "../useStatoVista";
import { RigheTabella, Testate, stileTabella, useColonne, useTabella } from "./righe";

const PASSO = 100;

export const TabellaRighe = ({ pagina }: { pagina: StatoPagina }) => {
  const { stato, cambia } = pagina;
  const q = useRighe(stato.risorsa, { filtri: pulisci(stato.filtri), ordine: stato.ordine, colonne: colonneDi(stato) }, PASSO);
  const colonne = useColonne(stato.colonne);
  const tabella = useTabella(q.righe, colonne);
  const fondo = useRef<HTMLTableRowElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;

  useEffect(() => {
    const el = fondo.current;
    if (!el || !hasNextPage) return;
    const o = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    o.observe(el);
    return () => o.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, q.righe.length]);

  if (q.error) return <Errore messaggio={messaggioDi(q.error, "Le righe non si sono caricate.")} onRiprova={() => void q.refetch()} />;
  if (q.isPending) return <Puntini etichetta="Carico le righe" />;
  if (!q.righe.length) return <Vuoto conFiltri={haFiltri(stato)} onTogli={() => cambia({ filtri: { e: [] } })} />;
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-10 pl-5" data-griglia="tanstack" data-righe-caricate={q.righe.length}>
      <table className="w-full border-separate border-spacing-0" style={stileTabella(stato.colonne)}>
        <Testate colonne={stato.colonne} ordine={stato.ordine} onOrdina={(ordine) => cambia({ ordine })} onColonne={pagina.sistemaColonne} />
        <tbody>
          <RigheTabella tabella={tabella} />
          {hasNextPage ? (
            <tr ref={fondo}>
              {}
              <td colSpan={stato.colonne.length + 1} className="h-8 animate-pulse text-center tracking-[0.2em] text-mute">
                {isFetchingNextPage ? "..." : null}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};
