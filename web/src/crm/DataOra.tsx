import { useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type Ref } from "react";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { spostaGiorno } from "@/crm/attivita/tempo";
import { dataEOra, giornoRoma } from "@/crm/tempo";
import { conGiorno, istanteRoma, oraRoma } from "@/crm/viste/tempo";
import { cn } from "@/lib/utils";

export const ORA_VUOTA = "09:00";

const ORARI = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const SETTIMANA = ["L", "M", "M", "G", "V", "S", "D"];
const MESE = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", month: "long", year: "numeric" });
const GIORNO_INTERO = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const FRECCE: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
const FUORI_ROMA = Intl.DateTimeFormat().resolvedOptions().timeZone !== "Europe/Rome";

export const leggiOra = (testo: string): string | null => {
  const m = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(testo.trim());
  if (!m) return null;
  const [h, mi] = [Number(m[1]), Number(m[2] ?? 0)];
  return h > 23 || mi > 59 ? null : `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
};

const caselleDi = (mese: string): string[] => {
  const [a, m] = mese.split("-").map(Number);
  const prima = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(a, m - 1, 1 - prima + i)).toISOString().slice(0, 10));
};
const spostaMese = (mese: string, n: number) => {
  const [a, m] = mese.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const aMezzogiorno = (giorno: string) => new Date(`${giorno}T12:00:00Z`);

const leggibile = (v: string | null | undefined): string | null => (v && !Number.isNaN(Date.parse(v)) ? v : null);

interface PropsPannello {
  valore: string | null | undefined;
  oraVuota?: string;
  min?: string;
  svuotabile?: boolean;
  onFine: (v: string | null) => void;
  onAnnulla: () => void;
  esciRef?: MutableRefObject<(() => boolean) | null>;
}

export const PannelloDataOra = ({ valore, oraVuota = ORA_VUOTA, min, svuotabile = true, onFine, onAnnulla, esciRef }: PropsPannello) => {
  const v = leggibile(valore);
  const oggi = giornoRoma();
  const inizioGiorno = v ? giornoRoma(v) : "";
  const inizioOra = v ? oraRoma(v).slice(0, 5) : oraVuota;
  const [giorno, setGiorno] = useState(inizioGiorno);
  const [testoOra, setTestoOra] = useState(inizioOra);
  const [mese, setMese] = useState((inizioGiorno || oggi).slice(0, 7));
  const [oraSbagliata, setOraSbagliata] = useState(false);
  const [fuoco, setFuoco] = useState<string | null>(null);
  const radice = useRef<HTMLDivElement>(null);
  const elenco = useRef<HTMLDivElement>(null);
  const chiuso = useRef(false);
  const ora = leggiOra(testoOra);
  const primoGiorno = min && min > oggi ? min : oggi;

  const risultato = (g: string, o: string): string | null => {
    if (!g) return null;
    if (!v) return istanteRoma(g, o);
    if (o !== inizioOra) return istanteRoma(g, o);
    return g === inizioGiorno ? v : conGiorno(v, g);
  };
  const scrivi = (r: string | null) => {
    chiuso.current = true;
    onFine(r);
  };
  const conferma = (g = giorno) => {
    if (chiuso.current) return;
    if (!ora) return setOraSbagliata(true);
    const r = risultato(g || (ora !== inizioOra ? primoGiorno : ""), ora);
    if (r !== v) return scrivi(r);
    chiuso.current = true;
    onAnnulla();
  };
  if (esciRef) {
    esciRef.current = () => {
      if (chiuso.current) return false;
      const r = risultato(giorno, ora ?? inizioOra);
      if (r === v) return false;
      scrivi(r);
      return true;
    };
  }

  const prendiGiorno = (g: string) => {
    setGiorno(g);
    setMese(g.slice(0, 7));
  };
  const prendiOra = (o: string) => {
    setTestoOra(o);
    setOraSbagliata(false);
    if (!giorno) prendiGiorno(primoGiorno);
  };

  const tasti = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      chiuso.current = true;
      onAnnulla();
    } else if (e.key === "Enter") {
      if (t.tagName === "BUTTON" && !t.dataset.giorno && !t.dataset.ora) return;
      e.preventDefault();
      e.stopPropagation();
      conferma(t.dataset.giorno ?? giorno);
    } else if (FRECCE[e.key] && t.dataset.giorno) {
      e.preventDefault();
      const n = spostaGiorno(t.dataset.giorno, FRECCE[e.key]);
      if (min && n < min) return;
      prendiGiorno(n);
      setFuoco(n);
    }
  };

  const caselle = caselleDi(mese);
  const aFuoco = caselle.includes(giorno) ? giorno : caselle.includes(oggi) ? oggi : `${mese}-01`;

  useEffect(() => {
    if (fuoco) radice.current?.querySelector<HTMLElement>(`[data-giorno="${fuoco}"]`)?.focus({ preventScroll: true });
  }, [fuoco, mese]);
  useEffect(() => {
    radice.current?.querySelector<HTMLElement>('[data-giorno][tabindex="0"]')?.focus({ preventScroll: true });
    const ultimo = ORARI.filter((o) => o <= inizioOra).pop() ?? ORARI[0];
    const voce = elenco.current?.querySelector<HTMLElement>(`[data-ora="${ultimo}"]`);
    if (elenco.current && voce) elenco.current.scrollTop = voce.offsetTop - elenco.current.clientHeight / 2 + voce.clientHeight / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo all'apertura
  }, []);

  const anteprima = giorno && ora ? dataEOra(risultato(giorno, ora) as string) : null;
  return (
    <div ref={radice} data-pannello-data onKeyDown={tasti} className="grid w-[336px] gap-2 p-2.5 text-cella text-ink">
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" data-scorciatoia="oggi" disabled={!!min && oggi < min} onClick={() => prendiGiorno(oggi)}>
          Oggi
        </Button>
        <Button type="button" variant="outline" size="sm" data-scorciatoia="domani" onClick={() => prendiGiorno(spostaGiorno(oggi, 1))}>
          Domani
        </Button>
        <span data-anteprima className={cn("ml-auto truncate font-medium tabular-nums", !anteprima && "font-normal text-mute")}>
          {anteprima ?? "Scegli un giorno"}
        </span>
      </div>

      <div className="grid grid-cols-[224px_minmax(0,1fr)] gap-2.5">
        <div>
          <div className="mb-1 flex items-center">
            <button type="button" aria-label="Mese prima" data-mese-prima onClick={() => setMese(spostaMese(mese, -1))} className="grid size-7 place-items-center rounded-md text-ink2 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4">
              <ChevronLeft />
            </button>
            <span data-mese={mese} className="min-w-0 flex-1 text-center font-medium first-letter:uppercase">
              {MESE.format(aMezzogiorno(`${mese}-01`))}
            </span>
            <button type="button" aria-label="Mese dopo" data-mese-dopo onClick={() => setMese(spostaMese(mese, 1))} className="grid size-7 place-items-center rounded-md text-ink2 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4">
              <ChevronRight />
            </button>
          </div>
          <div role="group" aria-label="Giorno" className="grid grid-cols-7 justify-items-center">
            {SETTIMANA.map((g, i) => (
              <span key={i} aria-hidden="true" className="grid h-6 place-items-center text-xs text-mute">
                {g}
              </span>
            ))}
            {caselle.map((g) => {
              const scelto = g === giorno;
              return (
                <button
                  key={g}
                  type="button"
                  data-giorno={g}
                  tabIndex={g === aFuoco ? 0 : -1}
                  disabled={!!min && g < min}
                  aria-pressed={scelto}
                  aria-label={GIORNO_INTERO.format(aMezzogiorno(g))}
                  onClick={() => prendiGiorno(g)}
                  className={cn(
                    "size-[30px] rounded-md tabular-nums outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/50 disabled:text-assente disabled:hover:bg-transparent",
                    !g.startsWith(mese) && "text-mute",
                    g === oggi && "font-semibold text-acc-ink",
                    scelto && "bg-primary font-medium text-primary-foreground hover:bg-primary",
                  )}
                >
                  {Number(g.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="block">
            <span className="sr-only">Ora</span>
            <input
              data-ora-libera
              aria-label="Ora"
              aria-invalid={oraSbagliata}
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              placeholder="09:00"
              value={testoOra}
              onChange={(e) => {
                setTestoOra(e.target.value);
                setOraSbagliata(false);
              }}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                if (!ora) return setOraSbagliata(true);
                setTestoOra(ora);
                if (!giorno && ora !== inizioOra) prendiGiorno(primoGiorno);
              }}
              className={cn(
                "h-7 w-full rounded-md border border-input bg-background px-2 text-center text-ink tabular-nums outline-none focus-visible:border-acc focus-visible:ring-3 focus-visible:ring-acc-soft",
                oraSbagliata && "border-danger",
              )}
            />
          </label>
          <div ref={elenco} role="listbox" aria-label="Orari" className="relative h-[186px] overflow-y-auto rounded-md border border-line p-0.5">
            {ORARI.map((o) => (
              <button
                key={o}
                type="button"
                role="option"
                data-ora={o}
                tabIndex={-1}
                aria-selected={o === ora}
                onClick={() => prendiOra(o)}
                className={cn("block w-full rounded-[5px] py-0.5 text-center text-ink2 tabular-nums outline-none hover:bg-hover", o === ora && "bg-primary font-medium text-primary-foreground hover:bg-primary")}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>

      {oraSbagliata ? <p className="text-xs text-danger">Scrivi l'ora così: 15:30</p> : null}
      {FUORI_ROMA ? <p className="text-xs text-mute">L'ora è quella di Roma.</p> : null}

      <div className="flex items-center gap-1.5 border-t border-line2 pt-2">
        {svuotabile ? (
          <Button type="button" variant="ghost" size="sm" data-svuota disabled={!giorno && !v} onClick={() => (v ? scrivi(null) : onAnnulla())}>
            Svuota
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            chiuso.current = true;
            onAnnulla();
          }}
        >
          Annulla
        </Button>
        <Button type="button" size="sm" data-fatto onClick={() => conferma()}>
          Fatto
        </Button>
      </div>
    </div>
  );
};

const ASPETTO =
  "inline-flex h-[30px] w-full min-w-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-left text-ink tabular-nums outline-none focus-visible:border-acc focus-visible:ring-3 focus-visible:ring-acc-soft aria-invalid:border-danger disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-mute-deco";

export const DataOra = ({
  valore,
  onCambia,
  onChiudi,
  etichetta,
  id,
  vuoto = "Scegli data e ora",
  apertoSubito = false,
  invalido,
  disabilitato,
  bottoneRef,
  className,
  ...pannello
}: Pick<PropsPannello, "valore" | "oraVuota" | "min" | "svuotabile"> & {
  onCambia: (v: string | null) => void;
  onChiudi?: () => void;
  etichetta: string;
  id?: string;
  vuoto?: string;
  apertoSubito?: boolean;
  invalido?: boolean;
  disabilitato?: boolean;
  bottoneRef?: Ref<HTMLButtonElement>;
  className?: string;
}) => {
  const [aperto, setAperto] = useState(apertoSubito);
  const esci = useRef<(() => boolean) | null>(null);
  const v = leggibile(valore);
  const annulla = () => {
    setAperto(false);
    onChiudi?.();
  };
  return (
    <Popover
      open={aperto}
      onOpenChange={(a) => {
        if (a) return setAperto(true);
        if (esci.current?.()) return;
        annulla();
      }}
    >
      <PopoverTrigger
        ref={bottoneRef}
        id={id}
        type="button"
        data-data-ora
        disabled={disabilitato}
        aria-invalid={invalido || undefined}
        aria-label={`${etichetta}: ${v ? dataEOra(v) : "vuoto"}`}
        className={cn(ASPETTO, className)}
      >
        <CalendarClock />
        <span className={cn("min-w-0 truncate", !v && "text-mute")}>{v ? dataEOra(v) : vuoto}</span>
      </PopoverTrigger>
      <PopoverContent align="start" initialFocus={false} className="w-auto gap-0 p-0 shadow-pop">
        <PannelloDataOra
          {...pannello}
          valore={v}
          esciRef={esci}
          onAnnulla={annulla}
          onFine={(n) => {
            setAperto(false);
            onCambia(n);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
