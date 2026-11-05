import { useEffect, useMemo, useRef, useState } from "react";
import { LinkBase } from "ra-core";
import { X } from "lucide-react";
import { useSearchParams } from "react-router";
import { Notification } from "@/components/admin/notification";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haCarta, type Esito } from "./api";
import { Carta } from "./Carta";
import { BarraEsiti, BarraRichiamo, ESITI } from "./Esiti";
import { FinestraInteressato } from "./Interessato";
import { dateRapide } from "./quando";
import { CartaInCarica, chiamate, Errore, Riassunto, SenzaCarta, totaleSessione } from "./Stati";
import { useCoda } from "./useCoda";

const messaggio = (e: unknown) => (e instanceof Error && e.message ? e.message : "Il server non risponde.");

const tastoPerMe = (e: KeyboardEvent) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false;
  const t = e.target as HTMLElement | null;
  if (t?.closest?.("input, textarea, select, [contenteditable=true]")) return false;
  return !document.querySelector("[role=dialog]");
};

export const PaginaChiama = () => {
  const [cerca] = useSearchParams();
  const vista_id = cerca.get("vista") ?? undefined;
  const lista_id = cerca.get("lista") ?? undefined;
  const coda = useCoda(useMemo(() => ({ ...(vista_id ? { vista_id } : {}), ...(lista_id ? { lista_id } : {}) }), [vista_id, lista_id]));
  const [richiamo, setRichiamo] = useState(false);
  const [interessata, setInteressata] = useState(false);
  const notaRef = useRef<HTMLTextAreaElement>(null);
  const altraRef = useRef<HTMLButtonElement>(null);
  const radice = useRef<HTMLDivElement>(null);

  const { attuale, registra, carta } = coda;
  const c = !carta.error && haCarta(attuale) ? attuale : null;
  const idCarta = c?.azienda.id;
  const bloccata = coda.esito.isPending || carta.isPending;
  const date = useMemo(() => dateRapide(Date.now()), [idCarta, richiamo]); // eslint-disable-line react-hooks/exhaustive-deps

  const scegli = (e: Esito) => {
    if (e === "richiamare") setRichiamo(true);
    else if (e === "interessato") setInteressata(true);
    else registra(e);
  };

  useEffect(() => {
    setRichiamo(false);
    setInteressata(false);
    coda.esito.reset();
    radice.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCarta]);

  const gestisci = (e: KeyboardEvent) => {
    if (!tastoPerMe(e) || !c) {
      if (e.key === "Escape" && (e.target as HTMLElement | null)?.closest?.("textarea, input")) {
        (e.target as HTMLElement).blur();
      }
      return;
    }
    const n = Number(e.key);
    if (richiamo) {
      if (e.key === "Escape") setRichiamo(false);
      else if (n >= 1 && n <= date.length) registra("richiamare", date[n - 1].quando);
      else if (n === 4) altraRef.current?.click();
      else return;
    } else if (n >= 1 && n <= ESITI.length) {
      scegli(ESITI[n - 1].esito);
    } else if (e.key.toLowerCase() === "c") {
      document.querySelector<HTMLAnchorElement>("a[data-tel]")?.click();
    } else if (e.key.toLowerCase() === "n") {
      notaRef.current?.focus();
    } else {
      return;
    }
    e.preventDefault();
  };
  const gestore = useRef(gestisci);
  gestore.current = gestisci;
  useEffect(() => {
    const ascolta = (e: KeyboardEvent) => gestore.current(e);
    window.addEventListener("keydown", ascolta);
    return () => window.removeEventListener("keydown", ascolta);
  }, []);

  const fatte = totaleSessione(coda.sessione);
  const errore = coda.esito.error;

  return (
    <div ref={radice} tabIndex={-1} data-pagina="chiama" className="flex min-h-svh flex-col bg-side outline-none">
      <header className="flex h-testata shrink-0 items-center gap-3 border-b border-line bg-background px-4">
        <LinkBase to="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <X />
          Esci
        </LinkBase>
        <span className="font-semibold text-ink">Chiama</span>
        <span data-sessione={fatte} className="min-w-0 truncate text-ink2 tabular-nums">
          {chiamate(fatte)} in questa sessione
          {fatte ? (
            <span className="max-lg:hidden">
              : <Riassunto s={coda.sessione} />
            </span>
          ) : null}
        </span>
        {attuale ? (
          <span data-in-coda={attuale.in_coda} className="ml-auto shrink-0 text-ink2 tabular-nums">
            {attuale.in_coda.toLocaleString("it-IT")} in coda
          </span>
        ) : null}
      </header>
      <main className="flex w-full flex-1 flex-col px-4 py-5 lg:px-8">
        <section className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col rounded-[9px] border border-line bg-background shadow-carta">
          <div className="flex-1 p-6">
            {carta.error ? (
              <Errore messaggio={messaggio(carta.error)} onRiprova={() => carta.mutate()} />
            ) : !attuale ? (
              <CartaInCarica />
            ) : c ? (
              <Carta c={c} nota={coda.nota} onNota={coda.setNota} onChiama={coda.segnaChiamata} notaRef={notaRef} />
            ) : (
              <SenzaCarta in_coda={attuale.in_coda} sessione={coda.sessione} onRiprova={() => carta.mutate()} />
            )}
          </div>
          {c ? (
            <footer className="sticky bottom-0 space-y-2 rounded-b-[9px] border-t border-line bg-background p-4">
              {errore ? <Errore messaggio={messaggio(errore)} /> : null}
              {richiamo ? (
                <BarraRichiamo
                  date={date}
                  bloccata={bloccata}
                  altraRef={altraRef}
                  onScegli={(q) => registra("richiamare", q)}
                  onIndietro={() => setRichiamo(false)}
                />
              ) : (
                <BarraEsiti bloccata={bloccata} onEsito={scegli} />
              )}
            </footer>
          ) : null}
        </section>
      </main>
      {interessata && c ? (
        <FinestraInteressato
          azienda={c.azienda.id}
          referente={c.chi_chiedere.persona?.nome || c.chi_chiedere.referente}
          notaIniziale={coda.nota}
          onConferma={coda.interessato}
          onAnnulla={() => setInteressata(false)}
        />
      ) : null}
      <Notification />
    </div>
  );
};
