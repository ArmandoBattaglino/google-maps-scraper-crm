import type { ReactNode } from "react";
import { useGetOne, useUpdate } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import {
  AtSign,
  Building2,
  CalendarClock,
  Clock,
  FileText,
  Globe,
  MapPin,
  Phone,
  Shapes,
  StickyNote,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ChipSocio, LogoAzienda } from "@/components/crm/forme";
import { buttonVariants } from "@/components/ui/button";
import { Timeline } from "@/crm/attivita";
import { CampiPersonalizzati } from "@/crm/scheda/CampiPersonalizzati";
import { Campo, TitoloScheda } from "@/crm/scheda/Campo";
import { GrigliaCampi, Identita, LayoutScheda, PercorsoScheda, Puntini, SchedaMancante } from "@/crm/scheda/Scheda";
import { nomeDi, useFasi, useSoci } from "@/crm/scheda/dati";
import { quandoBreve } from "@/crm/scheda/formati";
import { dataEOra } from "@/crm/tempo";
import { BottoneWhatsapp } from "@/crm/whatsapp";
import { cn } from "@/lib/utils";
import { AvvisoDoppioni } from "./AvvisoDoppioni";
import { AziendaLato, useLegamiAzienda } from "./AziendaLato";
import { BadgeCrm } from "./celle";
import { chiedi } from "@/crm/chiama/api";
import { StatoCella, type Stato } from "@/crm/colonne/celle";
import { destinoDaStato, SuPiuRecente, useScriviSegue } from "@/crm/colonne/segue";
import type { Azienda as RigaAzienda } from "./aggregati";
import { normaTelefono, verificaDoppioni, type Chiave } from "./doppioni";
import { useSchedaAzienda } from "./useSchedaAzienda";
import { DaDoveScheda } from "@/crm/origini/DaDoveScheda";

interface Azienda {
  id: string;
  nome: string;
  telefono: string;
  sito: string;
  piva: string;
  email: string;
  indirizzo: string;
  comune: string;
  categoria: string;
  referente: string;
  esito: string;
  richiamare_il?: string | null;
  ultima_chiamata?: string | null;
  tentativi?: number;
  note: string;
  contatto_id?: string | null;
}

const sitoApribile = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);
const perChiamare = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;

const Dati = ({ a }: { a: Azienda }) => {
  const [aggiorna] = useUpdate();
  const { scheda, salva: salvaScheda } = useSchedaAzienda(a.id);
  const soci = useSoci();
  const fasi = useFasi();
  const { persone, trattative } = useLegamiAzienda(a.id);
  const { data: contatto } = useGetOne<{ id: string; fase: string }>("contatti", { id: a.contatto_id ?? "" }, { enabled: !!a.contatto_id });
  const calcolata = useSchedaCalcolata(a.id);
  const c = calcolata?.calcolati;
  const conTrattative = (calcolata?.trattative_totali ?? 0) > 0;
  const scriviSegue = useScriviSegue();
  const destino = destinoDaStato(calcolata?.stato, a.id);
  const suTrattativa = destino?.su === "trattativa" ? destino : null;
  const salva = (campo: string, nullSeVuoto = false) => (v: string) =>
    aggiorna(
      "aziende",
      { id: a.id, data: { [campo]: nullSeVuoto && !v ? null : v }, previousData: a },
      { mutationMode: "pessimistic", returnPromise: true },
    );
  const controlla = (chiave: Chiave) => async (v: string) => {
    const d = await verificaDoppioni({ [chiave]: v }, a.id);
    return d.length ? <AvvisoDoppioni doppioni={d} /> : null;
  };
  const sotto = [a.categoria, a.comune].filter(Boolean).join(", ");
  const numero = normaTelefono(a.telefono);
  return (
    <LayoutScheda lato={<AziendaLato azienda={a.id} esito={a.esito} contatto={a.contatto_id} referente={a.referente} persone={persone} trattative={trattative} />}>
      <PercorsoScheda lista="Aziende" listaUrl="/aziende" nome={a.nome} />
      <Identita
        segno={<LogoAzienda nome={a.nome} grande />}
        titolo={<TitoloScheda nome="nome" etichetta="Nome" valore={a.nome} onSalva={salva("nome")} />}
        sotto={sotto || undefined}
        etichette={
          <>
            <StatoAzienda azienda={a.id} />
            <BadgeCrm contatto={a.contatto_id} tipo={contatto ? fasi.get(contatto.fase)?.tipo : undefined} />
            {c?.segue ? (
              <span data-seguita-da className="inline-flex items-center gap-1.5 text-xs text-mute">
                Seguita da <ChipSocio nome={nomeDi(soci, c.segue)} />
              </span>
            ) : null}
          </>
        }
        azioni={
          <>
            {numero ? (
              <a href={perChiamare(a.telefono)} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                <Phone className="size-3.5" />
                Chiama
              </a>
            ) : null}
            {}
            <BottoneWhatsapp azienda_id={a.id} size="sm" />
          </>
        }
      />
      <GrigliaCampi>
        <Campo nome="telefono" etichetta="Telefono" icona={<Phone />} valore={a.telefono} href={numero ? perChiamare(a.telefono) : undefined} controlla={controlla("telefono")} onSalva={salva("telefono")} />
        <Campo nome="sito" etichetta="Sito" icona={<Globe />} valore={a.sito} href={a.sito ? sitoApribile(a.sito) : undefined} controlla={controlla("sito")} onSalva={salva("sito")} />
        <Campo nome="email" etichetta="Email" icona={<AtSign />} valore={a.email} href={a.email ? `mailto:${a.email}` : undefined} controlla={controlla("email")} onSalva={salva("email")} />
        <Campo nome="piva" etichetta="Partita IVA" icona={<FileText />} valore={a.piva} controlla={controlla("piva")} onSalva={salva("piva")} />
        <Campo nome="indirizzo" etichetta="Indirizzo" icona={<MapPin />} valore={a.indirizzo} onSalva={salva("indirizzo")} />
        <Campo nome="comune" etichetta="Comune" icona={<Building2 />} valore={a.comune} onSalva={salva("comune")} />
        <Campo nome="categoria" etichetta="Categoria" icona={<Shapes />} valore={a.categoria} onSalva={salva("categoria")} />
        <Campo nome="referente" etichetta="Referente" icona={<UserRound />} valore={a.referente} onSalva={salva("referente")} />
        {conTrattative && !suTrattativa ? (
          <CampoCalcolato nome="segue" etichetta="Segue" icona={<UsersRound />} valore={c?.segue ? nomeDi(soci, c.segue) : null} />
        ) : (
          <Campo
            nome="segue"
            etichetta="Segue"
            icona={<UsersRound />}
            tipo="scelta"
            opzioni={soci.map((s) => ({ id: s.email, name: s.nome || s.email }))}
            valore={(suTrattativa ? c?.segue : scheda?.segue) ?? ""}
            mostra={(suTrattativa ? c?.segue : scheda?.segue) ? <>{nomeDi(soci, (suTrattativa ? c?.segue : scheda?.segue) ?? "")}{suTrattativa ? <SuPiuRecente altre={suTrattativa.altre} /> : null}</> : undefined}
            onSalva={(v) => (suTrattativa ? scriviSegue(suTrattativa, v || null) : salvaScheda({ segue: v || null }))}
          />
        )}
        {conTrattative ? (
          <CampoCalcolato nome="richiamare_il" etichetta="Prossimo" icona={<CalendarClock />} valore={c?.richiamare_il ? dataEOra(c.richiamare_il) : null} />
        ) : (
          <Campo nome="richiamare_il" etichetta="Da richiamare il" icona={<CalendarClock />} tipo="dataora" valore={a.richiamare_il ?? ""} mostra={a.richiamare_il ? dataEOra(a.richiamare_il) : undefined} onSalva={salva("richiamare_il", true)} />
        )}
        <div className="grid grid-cols-[150px_minmax(0,1fr)] items-start" data-campo="ultima_chiamata">
          <dt className="flex min-h-8 items-center gap-2 text-mute [&_svg]:size-3.5 [&_svg]:text-mute-deco">
            <Clock />
            Ultima chiamata
          </dt>
          <dd className="m-0 flex min-h-8 items-center px-2 text-ink2">
            {c?.ultima_chiamata ? `${quandoBreve(c.ultima_chiamata)}, ${c.tentativi ?? 0} tentativi` : <span className="text-assente">—</span>}
          </dd>
        </div>
        <Campo nome="note" etichetta="Note sull'azienda" icona={<StickyNote />} tipo="area" intero valore={a.note} onSalva={salva("note")} />
      </GrigliaCampi>
      <DaDoveScheda azienda={a.id} senzaFreddo />
      <CampiPersonalizzati oggetto="azienda" valori={scheda?.campi ?? {}} onSalva={(campi) => salvaScheda({ campi })} />
      <Timeline azienda_id={a.id} />
    </LayoutScheda>
  );
};

const useSchedaCalcolata = (azienda: string) =>
  useQuery({
    queryKey: ["aziende", "stato", azienda],
    queryFn: () => chiedi<{ stato?: Stato | null; calcolati?: RigaAzienda["calcolati"]; trattative_totali?: number }>(`/aziende/${encodeURIComponent(azienda)}/scheda`),
  }).data;

const CampoCalcolato = ({ nome, etichetta, icona, valore }: { nome: string; etichetta: string; icona: ReactNode; valore: string | null }) => (
  <div className="grid grid-cols-[150px_minmax(0,1fr)] items-start" data-campo={nome} title="Si cambia dalla trattativa">
    <dt className="flex min-h-8 items-center gap-2 text-mute [&_svg]:size-3.5 [&_svg]:text-mute-deco">
      {icona}
      {etichetta}
    </dt>
    <dd className="m-0 flex min-h-8 items-center px-2 text-ink2">{valore ?? <span className="text-assente">—</span>}</dd>
  </div>
);

const StatoAzienda = ({ azienda }: { azienda: string }) => {
  const data = useSchedaCalcolata(azienda);
  return (
    <span data-stato-scheda className="inline-flex items-center">
      {data ? <StatoCella stato={data.stato} /> : null}
    </span>
  );
};

export const AziendaScheda = () => {
  const { id = "" } = useParams();
  const { data, isPending, error } = useGetOne<Azienda>("aziende", { id });
  if (isPending) {
    return (
      <div className="px-8 py-12">
        <Puntini etichetta="Carico la scheda" />
      </div>
    );
  }
  if (error || !data) return <SchedaMancante cosa="Azienda" lista="Aziende" listaUrl="/aziende" />;
  return <Dati a={data} />;
};
