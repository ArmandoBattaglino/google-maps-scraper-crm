import { PRIMA_ENTITA } from "@/crm/entita";
import { Testata } from "@/layout/Testata";
import { Salva } from "./Barra/Salva";
import { SceltaVista } from "./Barra/SceltaVista";
import { messaggioDi } from "./Barra/forme";
import { BarraViste } from "./BarraViste";
import { Corpo } from "./Corpo";
import { FornitoreContesto, useContesto } from "./contesto";
import { useConteggi, useSegnaleSchede } from "./dati";
import { Errore, Puntini } from "./forme";
import { TUTTE } from "./stato";
import { useStatoVista, type StatoPagina } from "./useStatoVista";

const numeri = new Intl.NumberFormat("it-IT");

const Conteggio = ({ pagina }: { pagina: StatoPagina }) => {
  const { filtrate, tutte } = useConteggi(pagina.stato);
  if (filtrate === undefined) return null;
  return (
    <span data-conteggio={filtrate}>
      {numeri.format(filtrate)}
      {tutte !== undefined ? ` di ${numeri.format(tutte)}` : ""}
    </span>
  );
};

const Dentro = ({ pagina }: { pagina: StatoPagina }) => {
  const ctx = useContesto();
  const { stato, vista, viste, apri } = pagina;
  useSegnaleSchede(stato.risorsa);
  return (
    <div data-pagina="viste" data-risorsa={stato.risorsa} className="flex min-h-0 flex-1 flex-col">
      <Testata
        titolo={<SceltaVista titolo={vista?.nome ?? TUTTE[stato.risorsa]} risorsa={stato.risorsa} vista={vista} viste={viste} onApri={apri} />}
        conteggio={<Conteggio pagina={pagina} />}
        azioni={<Salva pagina={pagina} />}
      />
      {ctx.errore ? (
        <Errore messaggio={messaggioDi(ctx.errore, "I campi di questa tabella non si sono caricati.")} />
      ) : ctx.inCaricamento ? (
        <Puntini etichetta="Carico i campi" />
      ) : (
        <>
          <BarraViste pagina={pagina} />
          <Corpo pagina={pagina} />
        </>
      )}
    </div>
  );
};

export const PaginaViste = () => {
  const pagina = useStatoVista();
  if (pagina.vistaMancante) {
    return (
      <div data-pagina="viste">
        <Testata titolo="Viste" />
        <Errore messaggio="Questa vista non c'è più: forse è stata eliminata. I dati non si toccano, sono ancora tutti lì." azione={`Apri ${TUTTE[PRIMA_ENTITA]}`} onRiprova={() => pagina.apri({ risorsa: PRIMA_ENTITA })} />
      </div>
    );
  }
  if (pagina.inCaricamento) {
    return (
      <div data-pagina="viste">
        <Testata titolo="Viste" />
        <Puntini etichetta="Carico la vista" />
      </div>
    );
  }
  return (
    <FornitoreContesto risorsa={pagina.stato.risorsa}>
      <Dentro pagina={pagina} />
    </FornitoreContesto>
  );
};
