import { useMemo, useState } from "react";
import type { DatesSetArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import itLocale from "@fullcalendar/core/locales/it";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { useNavigate } from "react-router";
import { Scelta } from "@/crm/Scelta";
import type { DatiCrm } from "@/providers/dati";
import { messaggioDi } from "../Barra/forme";
import { useContesto } from "../contesto";
import { colonneDi, useCerca, type RigaVista } from "../dati";
import { conAncheFiltro, pulisci } from "../Filtri/albero";
import { Errore } from "../forme";
import { corpoPatch, editoreDi } from "../Tabella/editor";
import { schedaDi } from "../Tabella/Mostra";
import type { StatoPagina } from "../useStatoVista";
import "../viste.css";
import { colonneTitolo, eventoDi, nuovoValore } from "./eventi";

const PLUGIN = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];
const MASSIMO = 1000;
const TESTATA = { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" };
const giornoDi = (d: Date) => d.toISOString().slice(0, 10);

export default function CalendarioVista({ pagina }: { pagina: StatoPagina }) {
  const { stato, cambia } = pagina;
  const ctx = useContesto();
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const navigate = useNavigate();
  const [finestra, setFinestra] = useState<[string, string] | null>(null);

  const date = ctx.campi.filter((c) => c.tipo === "data" || c.tipo === "istante");
  const campo = stato.campo_data && ctx.voce(stato.campo_data) ? stato.campo_data : date[0]?.campo;
  const voce = campo ? ctx.voce(campo) : undefined;
  const trascinabile = !!campo && !!editoreDi(ctx, campo);
  const filtri = pulisci(stato.filtri);

  const q = useCerca(
    stato.risorsa,
    {
      filtri: campo && finestra ? conAncheFiltro(filtri, { campo, op: "tra", valore: finestra }) : filtri,
      ordine: campo ? [{ campo, dir: "asc" }] : [],
      colonne: colonneDi({ ...stato, gruppi: [], colonne: [], campo_data: campo ?? null }, colonneTitolo(stato.risorsa)),
      quanti: MASSIMO,
    },
    !!campo && !!finestra,
  );
  const senzaData = useCerca(stato.risorsa, { filtri: conAncheFiltro(filtri, { campo: campo ?? "", op: "vuoto" }), quanti: 0 }, !!campo);

  const eventi = useMemo(
    () => (q.data?.righe ?? []).flatMap((r) => eventoDi(stato.risorsa, r, campo ?? "", voce?.tipo ?? "istante", trascinabile) ?? []),
    [q.data, stato.risorsa, campo, voce?.tipo, trascinabile],
  );

  const quandoCambia = (i: DatesSetArg) => {
    const ultimo = new Date(i.end.getTime() - 86_400_000);
    setFinestra((f) => (f?.[0] === giornoDi(i.start) && f[1] === giornoDi(ultimo) ? f : [giornoDi(i.start), giornoDi(ultimo)]));
  };

  const lasciato = async (i: EventDropArg) => {
    const riga = i.event.extendedProps.riga as RigaVista;
    if (!campo || !i.event.start) return i.revert();
    const v = nuovoValore(voce?.tipo ?? "istante", riga[campo] ?? (riga.campi as Record<string, unknown>)?.[campo.slice(6)], i.event.start, i.delta.milliseconds === 0);
    try {
      await dp.patch(stato.risorsa, { id: riga.id, data: corpoPatch(stato.risorsa, riga, campo, v) });
      await qc.invalidateQueries({ queryKey: [stato.risorsa] });
    } catch (e) {
      i.revert();
      notify(messaggioDi(e, "La data non si è spostata"), { type: "error" });
    }
  };

  const apri = (i: EventClickArg) => {
    const s = schedaDi(stato.risorsa, i.event.extendedProps.riga as RigaVista);
    if (s) navigate(s);
  };

  if (!campo) return <Errore messaggio="Questa tabella non ha campi data: aggiungine uno in Campi personalizzati." />;
  if (q.error) return <Errore messaggio={messaggioDi(q.error, "Gli eventi non si sono caricati.")} onRiprova={() => void q.refetch()} />;
  return (
    <div data-griglia="calendario" data-eventi={eventi.length} data-senza-data={senzaData.data?.totale} className="calendario-crm flex min-h-0 flex-1 flex-col px-6 pb-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-ink2">
        Su quale data
        <Scelta
          etichetta="Su quale data"
          valore={campo}
          opzioni={date.map((c) => ({ valore: c.campo, etichetta: ctx.nome(c.campo) }))}
          onScegli={(campo_data) => cambia({ campo_data })}
          className="h-7"
        />
        {senzaData.data?.totale ? <span className="text-mute">{senzaData.data.totale} senza data</span> : null}
        {q.data && q.data.totale > MASSIMO ? <span className="text-warn">Qui ci sono le prime {MASSIMO} su {q.data.totale}: stringi i filtri.</span> : null}
      </div>
      <div className="min-h-0 flex-1">
        <FullCalendar
          plugins={PLUGIN}
          locale={itLocale}
          timeZone="UTC"
          initialView="dayGridMonth"
          headerToolbar={TESTATA}
          buttonText={{ list: "Elenco" }}
          height="100%"
          events={eventi}
          editable={trascinabile}
          eventDurationEditable={false}
          dayMaxEvents={4}
          nowIndicator
          noEventsText="Nessun evento in questi giorni"
          datesSet={quandoCambia}
          eventDrop={(i) => void lasciato(i)}
          eventClick={apri}
          eventDidMount={(i) => i.el.setAttribute("data-evento", i.event.id)}
        />
      </div>
    </div>
  );
}
