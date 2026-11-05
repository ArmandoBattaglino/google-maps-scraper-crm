import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ChipSocio } from "@/components/crm/forme";
import { messaggioDi } from "../Barra/forme";
import { eSocio, useContesto } from "../contesto";
import { colonneDi, totaliDi, useCerca, useRighe, type GruppoRisultato } from "../dati";
import { conAncheFiltro, pulisci } from "../Filtri/albero";
import { Errore, Puntini, Vuoto } from "../forme";
import { testoTotale, testoValore } from "../formato";
import type { Condizione, StatoVista } from "../stato";
import type { StatoPagina } from "../useStatoVista";
import { RigheTabella, Testate, stileTabella, useColonne, useTabella, type ColonnaRiga } from "./righe";

const PASSO = 100;
const APERTI_DI_PARTENZA = 5;

const condizioneDi = (g: GruppoRisultato): Condizione =>
  g.valore === null || g.valore === "" ? { campo: g.campo, op: "vuoto" } : { campo: g.campo, op: "uguale", valore: g.valore };

const RigheDelGruppo = ({ stato, colonne, percorso }: { stato: StatoVista; colonne: ColonnaRiga[]; percorso: Condizione[] }) => {
  const filtri = conAncheFiltro(pulisci(stato.filtri), ...percorso);
  const q = useRighe(stato.risorsa, { filtri, ordine: stato.ordine, colonne: colonneDi(stato) }, PASSO);
  const tabella = useTabella(q.righe, colonne);
  const celle = stato.colonne.length;
  if (q.error) {
    return (
      <tr>
        <td colSpan={celle + 1} className="px-2 py-2 text-danger">
          {messaggioDi(q.error, "Le righe di questo gruppo non si sono caricate.")}
        </td>
      </tr>
    );
  }
  if (q.isPending) {
    return (
      <tr>
        <td colSpan={celle + 1} className="animate-pulse px-2 py-2 tracking-[0.2em] text-mute">
          ...
        </td>
      </tr>
    );
  }
  return (
    <>
      <RigheTabella tabella={tabella} />
      {q.hasNextPage ? (
        <tr>
          <td colSpan={celle + 1} className="border-b border-line2 px-2 py-1.5">
            <button type="button" className="text-acc-ink hover:underline" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
              Mostra altre {Math.min(PASSO, q.totale - q.righe.length)} di {q.totale - q.righe.length}
            </button>
          </td>
        </tr>
      ) : null}
    </>
  );
};

const Gruppo = ({
  g,
  i,
  stato,
  colonne,
  percorso,
  livello,
}: {
  g: GruppoRisultato;
  i: number;
  stato: StatoVista;
  colonne: ColonnaRiga[];
  percorso: Condizione[];
  livello: number;
}) => {
  const ctx = useContesto();
  const [aperto, setAperto] = useState(i < APERTI_DI_PARTENZA);
  const qui = [...percorso, condizioneDi(g)];
  const nome = testoValore(ctx, g.campo, g.valore) || `Senza ${ctx.nome(g.campo).toLowerCase()}`;
  return (
    <>
      <tr data-gruppo={nome} data-n={g.n}>
        <td colSpan={stato.colonne.length + 1} className="h-10 border-b border-line bg-background px-2" style={{ paddingLeft: 8 + livello * 20 }}>
          <button type="button" aria-expanded={aperto} onClick={() => setAperto(!aperto)} className="flex items-center gap-2.5 text-left outline-none focus-visible:underline [&_svg]:size-3.5 [&_svg]:text-mute-deco">
            {aperto ? <ChevronDown /> : <ChevronRight />}
            {eSocio(g.campo, g.valore) ? <ChipSocio nome={nome} /> : <b className="font-semibold text-ink">{nome}</b>}
            <span className="rounded-[5px] bg-hover px-1.5 text-xs text-mute tabular-nums" data-numero>
              {g.n}
            </span>
            {Object.entries(g.totali).map(([k, v]) => {
              const t = testoTotale(ctx, k, v);
              return (
                <span key={k} data-totale={k} className="text-xs text-mute">
                  {t.nome} <b className="font-medium text-ink2 tabular-nums">{t.valore}</b>
                </span>
              );
            })}
          </button>
        </td>
      </tr>
      {!aperto ? null : g.gruppi ? (
        g.gruppi.map((f, k) => <Gruppo key={String(f.valore)} g={f} i={k} stato={stato} colonne={colonne} percorso={qui} livello={livello + 1} />)
      ) : (
        <RigheDelGruppo stato={stato} colonne={colonne} percorso={qui} />
      )}
    </>
  );
};

export const TabellaGruppi = ({ pagina }: { pagina: StatoPagina }) => {
  const { stato, cambia } = pagina;
  const q = useCerca(stato.risorsa, { filtri: pulisci(stato.filtri), ordine: stato.ordine, gruppi: stato.gruppi, totali: totaliDi(stato), quanti: 0 });
  const colonne = useColonne(stato.colonne);
  if (q.error) return <Errore messaggio={messaggioDi(q.error, "I gruppi non si sono caricati.")} onRiprova={() => void q.refetch()} />;
  if (q.isPending) return <Puntini etichetta="Carico i gruppi" />;
  if (!q.data.gruppi.length) return <Vuoto conFiltri onTogli={() => cambia({ filtri: { e: [] } })} />;
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-10 pl-5" data-griglia="gruppi">
      {q.data.gruppi_troncati ? (
        <p role="status" className="mb-2 rounded-md bg-warn-soft px-3 py-1.5 text-warn">
          Troppi gruppi: qui ci sono solo i primi. Stringi i filtri per vederli tutti.
        </p>
      ) : null}
      <table className="w-full border-separate border-spacing-0" style={stileTabella(stato.colonne)}>
        <Testate colonne={stato.colonne} ordine={stato.ordine} onOrdina={(ordine) => cambia({ ordine })} onColonne={pagina.sistemaColonne} />
        <tbody>
          {q.data.gruppi.map((g, i) => (
            <Gruppo key={String(g.valore)} g={g} i={i} stato={stato} colonne={colonne} percorso={[]} livello={0} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
