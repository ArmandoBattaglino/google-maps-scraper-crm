import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CalendarPlus, Check, ExternalLink, Link2, Phone, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Confirm } from "@/components/admin/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useElimina, useFatto } from "@/crm/attivita/dati";
import { domani, romaAIso } from "@/crm/attivita/tempo";
import { useMenu, VoceMenu } from "@/crm/azioni/MenuRiga";
import { ScegliColonne } from "@/crm/colonne/ScegliColonne";
import { TabellaCrm, type Ordine, type Sezione } from "@/crm/colonne/TabellaCrm";
import { useColonne } from "@/crm/colonne/useColonne";
import { hrefTelefono, pathAzienda, pathPersona } from "@/crm/persone/campi";
import { Segmenti } from "@/crm/Segmenti";
import { useSoci } from "@/crm/soci";
import { toniDelleFasi } from "@/crm/trattative/tipi";
import { useFasi } from "@/crm/trattative/useBacheca";
import { conGiorno } from "@/crm/viste/tempo";
import { Testata } from "@/layout/Testata";
import { cn } from "@/lib/utils";
import { NuovoCompito, SpostaCollegamento } from "./Collegato";
import { colonneCompiti, EXTRA_DI } from "./colonne";
import { useElencoCompiti, useGiorno, useModificaCompito, type Chi, type RigaCompito, type StatoCompiti } from "./dati";

const PASSO = 50;
const CHI: { valore: Chi; etichetta: string }[] = [
  { valore: "miei", etichetta: "Miei" },
  { valore: "team", etichetta: "Del team" },
];
const STATI: { valore: StatoCompiti; etichetta: string }[] = [
  { valore: "da_fare", etichetta: "Da fare" },
  { valore: "fatti", etichetta: "Fatti" },
];
const TITOLI: Record<string, string> = {
  scaduti: "Scaduti",
  oggi: "Oggi",
  domani: "Domani",
  settimana: "Questa settimana",
  dopo: "Più avanti",
  senza: "Senza data",
  fatti: "Fatti",
};

const SCORRE = "max-h-[calc(100svh-168px)] min-h-[240px]";

const it = (n: number) => n.toLocaleString("it-IT");

const schedaDi = (r: RigaCompito) =>
  r.legame === "trattativa" && r.trattativa_id ? `/trattative/${r.trattativa_id}` : r.legame === "persona" && r.persona_id ? pathPersona(r.persona_id) : pathAzienda(r.azienda_id ?? "");

export const PaginaCompiti = () => {
  const [cerca, setCerca] = useSearchParams();
  const navigate = useNavigate();
  const chi: Chi = cerca.get("di") === "team" ? "team" : "miei";
  const stato: StatoCompiti = cerca.get("stato") === "fatti" ? "fatti" : "da_fare";
  const campo = cerca.get("ordine");
  const dir = cerca.get("dir") === "desc" ? "desc" : "asc";
  const ordine: Ordine = campo ? { campo, dir } : stato === "fatti" ? { campo: "fatto_il", dir: "desc" } : { campo: "scadenza", dir: "asc" };
  const giorno = useGiorno();
  const { nomeDi, soci } = useSoci();
  const { fasi } = useFasi();
  const toni = useMemo(() => toniDelleFasi(fasi), [fasi]);
  const { segna } = useFatto();
  const modifica = useModificaCompito();
  const { togli, togliendo } = useElimina();

  const segnaOra = useRef(segna);
  segnaOra.current = segna;
  const riapri = useCallback((a: RigaCompito, fatto: boolean) => segnaOra.current(a, fatto), []);
  const tutte = useMemo(() => colonneCompiti({ nomeDi, soci, giorno, toni, riapri }), [nomeDi, soci, giorno, toni, riapri]);
  const colonne = useColonne("compiti", tutte);
  const extra = useMemo(() => colonne.visibili.flatMap((c) => EXTRA_DI[c.id] ?? []), [colonne.visibili]);

  const [testo, setTesto] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(testo.trim()), 250);
    return () => clearTimeout(t);
  }, [testo]);
  const [limiti, setLimiti] = useState<Record<string, number>>({});
  const [nuovo, setNuovo] = useState(false);
  const [daSpostare, setDaSpostare] = useState<RigaCompito | null>(null);
  const [daTogliere, setDaTogliere] = useState<RigaCompito | null>(null);

  const { data, isPending, error, refetch, isPlaceholderData } = useElencoCompiti({ chi, stato, q, giorno, ordine: campo, dir: campo ? dir : null, extra, limiti });
  const gruppi = useMemo(() => data?.gruppi ?? [], [data]);
  const totale = data?.totale ?? (data ? 0 : undefined);
  const perId = useMemo(() => new Map(gruppi.flatMap((g) => g.righe.map((r) => [r.id, r] as const))), [gruppi]);

  const cambia = (nuovi: Record<string, string | null>) => {
    const p = new URLSearchParams(cerca);
    for (const [k, v] of Object.entries(nuovi)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setCerca(p);
  };

  const { apri, riga, disegna } = useMenu<RigaCompito>();
  const rimanda = (r: RigaCompito) => void modifica(r.id, { scadenza: r.scadenza ? conGiorno(r.scadenza, domani()) : romaAIso(`${domani()}T23:59:59`) });
  const tel = riga ? hrefTelefono(riga.persona_telefono || riga.azienda_telefono || "") : undefined;
  const menu = disegna(
    riga ? (
      <>
        <VoceMenu icona={<ExternalLink />} testo="Apri la scheda" onClick={() => navigate(schedaDi(riga))} />
        {tel ? <VoceMenu icona={<Phone />} testo="Chiama" href={tel} /> : null}
        {riga.fatto_il ? (
          <VoceMenu icona={<RotateCcw />} testo="Riapri" onClick={() => void segna(riga, false)} />
        ) : (
          <>
            <VoceMenu icona={<CalendarPlus />} testo="Rimanda a domani" onClick={() => rimanda(riga)} />
            <VoceMenu icona={<Check />} testo="Segna fatto" onClick={() => void segna(riga, true)} />
          </>
        )}
        <VoceMenu icona={<Link2 />} testo="Sposta il collegamento" onClick={() => setDaSpostare(riga)} />
        <VoceMenu icona={<Trash2 />} testo="Elimina" pericolo onClick={() => setDaTogliere(riga)} />
      </>
    ) : null,
  );

  const sezioni: Sezione<RigaCompito>[] = gruppi.map((g) => ({
    chiave: g.chiave,
    titolo: TITOLI[g.chiave] ?? g.chiave,
    numero: it(g.n),
    scaduta: g.chiave === "scaduti",
    righe: g.righe,
    piede:
      g.n > g.righe.length ? (
        <Button variant="ghost" size="sm" onClick={() => setLimiti((l) => ({ ...l, [g.chiave]: (l[g.chiave] ?? PASSO) + PASSO }))}>
          Mostra altri ({it(g.n - g.righe.length)})
        </Button>
      ) : null,
  }));

  return (
    <div data-pagina="compiti" className="pb-6">
      <Testata
        titolo="Compiti"
        conteggio={totale === undefined ? undefined : it(totale)}
        azioni={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Segmenti etichetta="Di chi sono i compiti" opzioni={CHI} valore={chi} onScegli={(v) => cambia({ di: v === "team" ? "team" : null })} />
            <Segmenti etichetta="Da fare o fatti" opzioni={STATI} valore={stato} onScegli={(v) => cambia({ stato: v === "fatti" ? "fatti" : null, ordine: null, dir: null })} />
            <ScegliColonne stato={colonne} />
            <Button data-nuovo onClick={() => setNuovo(true)}>
              <Plus />
              Nuovo compito
            </Button>
          </div>
        }
      />
      <div className="flex items-center gap-3 px-6 pb-2.5">
        <div className="relative w-[320px]">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-mute-deco" />
          <Input
            aria-label="Cerca nei compiti"
            data-cerca-compiti
            placeholder="Cerca compito, azienda, persona, telefono"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            className="h-[30px] pl-7"
          />
        </div>
        {stato === "da_fare" && data && !q ? (
          <span data-entro-oggi={data.entro_oggi ?? 0} className={cn("tabular-nums", data.entro_oggi ? "text-ink2" : "text-mute")}>
            {it(data.entro_oggi ?? 0)} entro oggi
          </span>
        ) : null}
      </div>
      {isPending ? (
        <div data-compiti-carica aria-label="Sto leggendo i compiti" className="space-y-3 px-6 pt-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-3/5" />
        </div>
      ) : error && !data ? (
        <div role="alert" data-compiti-errore className="flex items-center gap-3 px-6 pt-2 text-ink2">
          Non riesco a leggere i compiti.
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Riprova
          </Button>
        </div>
      ) : !totale ? (
        <section data-compiti-vuoto className="mx-6 mt-2 max-w-[560px] rounded-lg border border-dashed border-line p-5">
          {q ? (
            <p className="font-medium text-ink">Nessun compito con «{q}».</p>
          ) : stato === "fatti" ? (
            <p className="font-medium text-ink">{chi === "miei" ? "Non hai compiti fatti." : "Il team non ha compiti fatti."}</p>
          ) : (
            <>
              <p className="font-medium text-ink">{chi === "miei" ? "Non hai compiti aperti." : "Il team non ha compiti aperti."}</p>
              <p className="mt-1 text-ink2">Un compito sta su un'azienda, una persona o una trattativa: si crea da qui, o dalla loro cronologia.</p>
              <Button variant="outline" className="mt-4" onClick={() => setNuovo(true)}>
                Nuovo compito
              </Button>
            </>
          )}
        </section>
      ) : (
        <div aria-busy={isPlaceholderData} className={cn("pr-4 pl-5", isPlaceholderData && "opacity-70")}>
          <TabellaCrm<RigaCompito>
            stato={colonne}
            propria="Compito"
            sezioni={sezioni}
            ordine={ordine}
            onOrdina={(o) => cambia({ ordine: o.campo, dir: o.dir })}
            datiRiga={(r) => ({ "data-compito": r.id })}
            perMenu={(r) => ({ id: r.id })}
            onMenu={(e, { id }) => {
              const r = perId.get(id);
              if (r) apri(e, r);
            }}
            className={SCORRE}
          />
        </div>
      )}
      {menu}
      {nuovo ? <NuovoCompito onChiudi={() => setNuovo(false)} /> : null}
      {daSpostare ? <SpostaCollegamento compito={daSpostare} onChiudi={() => setDaSpostare(null)} /> : null}
      <Confirm
        isOpen={daTogliere !== null}
        loading={togliendo}
        title="Eliminare questo compito?"
        content="Sparisce dal CRM. Non si può annullare."
        confirm="Elimina"
        cancel="Annulla"
        onClose={() => setDaTogliere(null)}
        onConfirm={() => {
          if (daTogliere) void togli(daTogliere).then(() => setDaTogliere(null));
        }}
      />
    </div>
  );
};
