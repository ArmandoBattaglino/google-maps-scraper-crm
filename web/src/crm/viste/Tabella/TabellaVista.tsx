import { lazy, Suspense } from "react";
import { AzioniRiga, useAzioniRiga } from "@/crm/azioni/MenuRiga";
import { messaggioDi } from "../Barra/forme";
import { useCerca } from "../dati";
import { pulisci } from "../Filtri/albero";
import { Errore, Puntini } from "../forme";
import type { StatoPagina } from "../useStatoVista";
import { TabellaGruppi } from "./TabellaGruppi";
import { TabellaRighe } from "./TabellaRighe";
import { FornitoreModifica } from "./useModifica";

const Griglia = lazy(() => import("./Griglia"));

export const SOGLIA_GLIDE = 2000;

export const TabellaVista = ({ pagina }: { pagina: StatoPagina }) => {
  const { stato } = pagina;
  const azioni = useAzioniRiga(stato.risorsa === "attivita" ? "aziende" : stato.risorsa);
  const senzaGruppi = !stato.gruppi.length;
  const conta = useCerca(stato.risorsa, { filtri: pulisci(stato.filtri), quanti: 0 }, senzaGruppi);
  let corpo;
  if (!senzaGruppi) corpo = <TabellaGruppi pagina={pagina} />;
  else if (conta.error) corpo = <Errore messaggio={messaggioDi(conta.error, "Le righe non si sono caricate.")} onRiprova={() => void conta.refetch()} />;
  else if (conta.isPending) corpo = <Puntini etichetta="Carico le righe" />;
  else if (conta.data.totale > SOGLIA_GLIDE) {
    corpo = (
      <Suspense fallback={<Puntini etichetta="Carico la griglia" />}>
        <Griglia pagina={pagina} totale={conta.data.totale} />
      </Suspense>
    );
  } else corpo = <TabellaRighe pagina={pagina} />;
  if (stato.risorsa === "attivita") return <FornitoreModifica risorsa={stato.risorsa}>{corpo}</FornitoreModifica>;
  return (
    <AzioniRiga.Provider value={azioni.apri}>
      <FornitoreModifica risorsa={stato.risorsa}>{corpo}</FornitoreModifica>
      {azioni.nodo}
    </AzioniRiga.Provider>
  );
};
