import { useState } from "react";
import { CalendarDays, MapPinned, SquareKanban, Table2 } from "lucide-react";
import { Segmenti } from "@/crm/Segmenti";
import { Campi } from "./Barra/Campi";
import { Ordina } from "./Barra/Ordina";
import { Raggruppa } from "./Barra/Raggruppa";
import { FANTASMA } from "./Barra/forme";
import { aggiungi, ANCHE_NON_AZIENDE, conAncheFiltro, legame, parlaDiEtichetta } from "./Filtri/albero";
import { Costruttore } from "./Filtri/Costruttore";
import { Pillole } from "./Filtri/Pillole";
import type { Modo, Risorsa } from "./stato";
import type { StatoPagina } from "./useStatoVista";

const MODI: { valore: Modo; etichetta: React.ReactNode; dove?: Risorsa[] }[] = [
  { valore: "tabella", etichetta: (<><Table2 />Tabella</>) },
  { valore: "kanban", etichetta: (<><SquareKanban />Kanban</>) },
  { valore: "calendario", etichetta: (<><CalendarDays />Calendario</>) },
  { valore: "mappa", etichetta: (<><MapPinned />Mappa</>) },
];

export const BarraViste = ({ pagina }: { pagina: StatoPagina }) => {
  const { stato, cambia } = pagina;
  const [filtriAperti, setFiltriAperti] = useState(false);
  return (
    <div data-barra-viste className="flex flex-wrap items-center gap-2 px-6 pb-2.5">
      <Segmenti
        etichetta="Vista"
        valore={stato.modo}
        onScegli={(modo) => cambia({ modo })}
        opzioni={MODI.filter((m) => !m.dove || m.dove.includes(stato.risorsa))}
      />
      <span className="mx-1 h-[18px] w-px bg-line" />
      <Pillole filtri={stato.filtri} onCambia={(filtri) => cambia({ filtri })} onApri={() => setFiltriAperti(true)} />
      <Costruttore filtri={stato.filtri} onCambia={(filtri) => cambia({ filtri })} aperto={filtriAperti} onAperto={setFiltriAperti} />
      {}
      {stato.risorsa === "aziende" && !parlaDiEtichetta(stato.filtri) ? (
        <button
          type="button"
          data-mostra-non-aziende
          className={FANTASMA}
          onClick={() =>
            cambia({
              filtri: legame(stato.filtri) === "e" ? aggiungi(stato.filtri, [], ANCHE_NON_AZIENDE) : conAncheFiltro(stato.filtri, ANCHE_NON_AZIENDE),
              colonne: stato.colonne.some((c) => c.campo === "etichetta") ? stato.colonne : [...stato.colonne, { campo: "etichetta" }],
            })
          }
        >
          Mostra anche le non-aziende
        </button>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        {stato.modo === "tabella" || stato.modo === "kanban" ? <Raggruppa gruppi={stato.gruppi} modo={stato.modo} onCambia={(gruppi) => cambia({ gruppi })} /> : null}
        {stato.modo === "tabella" ? <Ordina ordine={stato.ordine} onCambia={(ordine) => cambia({ ordine })} /> : null}
        {stato.modo === "tabella" || stato.modo === "kanban" ? <Campi colonne={stato.colonne} onCambia={(colonne) => cambia({ colonne })} /> : null}
      </div>
    </div>
  );
};
