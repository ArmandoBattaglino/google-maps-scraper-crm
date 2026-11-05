import { Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Maximize2, X } from "lucide-react";
import { LinkBase, ResourceContextProvider } from "ra-core";
import { ErrorBoundary } from "react-error-boundary";
import {
  Route,
  Routes,
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_NavigationContext as NavigationContext,
  UNSAFE_RouteContext as RouteContext,
  useNavigationType,
  type Location,
} from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginaCronologia } from "@/crm/attivita/PaginaCronologia";
import { AziendaNuova } from "@/crm/aziende/AziendaNuova";
import { AziendaScheda } from "@/crm/aziende/AziendaScheda";
import { PersonaModifica } from "@/crm/persone/PersonaModifica";
import { PersonaNuova } from "@/crm/persone/PersonaNuova";
import { PersonaScheda } from "@/crm/persone/PersonaScheda";
import { TrattativaScheda } from "@/crm/trattative/TrattativaScheda";
import { Attesa } from "@/layout/Avviso";
import { cn } from "@/lib/utils";
import { PostoPercorso } from "./contesto";
import { DentroPannello, primaDelRouter, usePannello } from "./Instradamento";
import "./pannello.css";

const USCITA_MS = 160;
const SORDO_MS = 350;

const sfondi = () => Array.from(document.querySelectorAll('main, [data-slot="sidebar"]')).filter((el) => !el.closest("[data-pannello]"));
const POPUP = [
  "[data-menu-riga]",
  '[data-slot="dialog-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="select-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="drawer-content"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="alertdialog"]',
  '[role="dialog"]:not([data-pannello])',
].join(",");

const popupAperto = () => {
  const sfondo = sfondi();
  return Array.from(document.querySelectorAll(POPUP)).some((el) => el.getClientRects().length > 0 && !sfondo.some((s) => s.contains(el)));
};

const siScrive = (el: Element) => el.matches("input, textarea, select, [contenteditable='true']");

const FOCUSABILI = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

const CONTESTO_VUOTO = { outlet: null, matches: [], isDataRoute: false };

const Schede = () => (
  <Routes>
    <Route path="aziende/create" element={<ResourceContextProvider value="aziende"><AziendaNuova /></ResourceContextProvider>} />
    <Route path="aziende/:id" element={<ResourceContextProvider value="aziende"><AziendaScheda /></ResourceContextProvider>} />
    <Route path="persone/create" element={<ResourceContextProvider value="persone"><PersonaNuova /></ResourceContextProvider>} />
    <Route path="persone/:id/modifica" element={<ResourceContextProvider value="persone"><PersonaModifica /></ResourceContextProvider>} />
    <Route path="persone/:id" element={<ResourceContextProvider value="persone"><PersonaScheda /></ResourceContextProvider>} />
    <Route path="trattative/:id" element={<ResourceContextProvider value="trattative"><TrattativaScheda /></ResourceContextProvider>} />
    <Route path="cronologia/:risorsa/:id" element={<PaginaCronologia />} />
  </Routes>
);

export const PannelloScheda = () => {
  const guida = usePannello();
  const navigazione = useContext(NavigationContext);
  const tipo = useNavigationType();
  const stato = guida?.stato ?? null;
  const aperta = stato && guida ? guida.vera : null;
  const attivo = !!aperta;

  const [mostrata, setMostrata] = useState<Location | null>(aperta);
  const [uscita, setUscita] = useState(false);
  if (aperta && aperta !== mostrata) {
    setMostrata(aperta);
    if (uscita) setUscita(false);
  } else if (!aperta && mostrata && !uscita) setUscita(true);

  useEffect(() => {
    if (!uscita) return;
    const ferma = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => {
      setMostrata(null);
      setUscita(false);
    }, ferma ? 0 : USCITA_MS);
    return () => clearTimeout(t);
  }, [uscita]);

  const foglio = useRef<HTMLElement>(null);
  const apertoDa = useRef(0);
  const premutoConPopup = useRef(false);
  const formToccato = useRef(false);
  const [posto, setPosto] = useState<HTMLElement | null>(null);
  const [inAttesa, setInAttesa] = useState<(() => void) | null>(null);

  const sporco = useCallback(
    () => formToccato.current || Array.from(foglio.current?.querySelectorAll<HTMLTextAreaElement>("[data-scrivi] textarea") ?? []).some((t) => t.value.trim() !== ""),
    [],
  );

  const chiudiPagina = guida?.chiudi;
  const chiudi = useCallback(() => {
    const a = document.activeElement;
    if (a instanceof HTMLElement && foglio.current?.contains(a)) a.blur();
    chiudiPagina?.();
  }, [chiudiPagina]);

  useLayoutEffect(() => {
    if (!attivo) return;
    const sfondo = sfondi();
    sfondo.forEach((s) => s.setAttribute("inert", ""));
    apertoDa.current = Date.now();
    const veglia = new MutationObserver(() => sfondo.forEach((s) => s.hasAttribute("inert") || s.setAttribute("inert", "")));
    sfondo.forEach((s) => veglia.observe(s, { attributes: true, attributeFilter: ["inert"] }));
    return () => {
      veglia.disconnect();
      sfondo.forEach((s) => s.removeAttribute("inert"));
    };
  }, [attivo]);

  const daRidare = guida?.daRidare;
  useEffect(() => {
    if (!attivo || !daRidare) return;
    foglio.current?.focus({ preventScroll: true });
    return () => {
      const d = daRidare.current;
      daRidare.current = null;
      if (d?.isConnected) d.focus({ preventScroll: true });
    };
  }, [attivo, daRidare]);

  useEffect(() => {
    if (!attivo) return;
    let conPopup = false;
    const prima = (e: KeyboardEvent) => {
      if (e.key === "Escape") conPopup = popupAperto();
      if (e.key !== "Tab" || popupAperto() || !foglio.current) return;
      const dentro = Array.from(foglio.current.querySelectorAll<HTMLElement>(FOCUSABILI));
      const a = document.activeElement;
      const fuori = !a || !foglio.current.contains(a);
      const primo = dentro[0];
      const ultimo = dentro[dentro.length - 1];
      if (!primo) return e.preventDefault();
      if (fuori || (e.shiftKey && (a === primo || a === foglio.current))) {
        e.preventDefault();
        (e.shiftKey ? ultimo : primo).focus();
      } else if (!e.shiftKey && a === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    };
    const dopo = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || conPopup || e.isComposing) return;
      const a = document.activeElement;
      if (a instanceof HTMLElement && foglio.current?.contains(a) && siScrive(a)) return a.blur();
      chiudi();
    };
    const premuto = () => {
      premutoConPopup.current = popupAperto();
    };
    window.addEventListener("keydown", prima, true);
    window.addEventListener("keydown", dopo);
    window.addEventListener("pointerdown", premuto, true);
    return () => {
      window.removeEventListener("keydown", prima, true);
      window.removeEventListener("keydown", dopo);
      window.removeEventListener("pointerdown", premuto, true);
    };
  }, [attivo, chiudi]);

  const salta = useRef(false);
  const lascia = useRef(false);
  const indice = useRef(0);
  useEffect(() => {
    indice.current = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    lascia.current = false;
    formToccato.current = false;
  }, [aperta]);
  const qc = useQueryClient();
  useEffect(
    () =>
      qc.getMutationCache().subscribe((e) => {
        if (e.type === "updated" && e.action.type === "pending") formToccato.current = false;
      }),
    [qc],
  );
  const guardia = guida?.guardia;
  useEffect(() => {
    if (!attivo || !guardia) return;
    guardia.current = (continua) => {
      if (!sporco()) return false;
      setInAttesa(() => continua);
      return true;
    };
    const pop = (e: PopStateEvent) => {
      if (salta.current) {
        salta.current = false;
        e.stopImmediatePropagation();
        return;
      }
      if (lascia.current) {
        lascia.current = false;
        return;
      }
      if (!sporco()) return;
      e.stopImmediatePropagation();
      const passi = indice.current - ((window.history.state as { idx?: number } | null)?.idx ?? 0);
      salta.current = true;
      window.history.go(passi);
      setInAttesa(() => () => window.history.go(-passi));
    };
    const ricarica = (e: BeforeUnloadEvent) => {
      if (sporco()) e.preventDefault();
    };
    primaDelRouter.pop = pop;
    window.addEventListener("beforeunload", ricarica);
    return () => {
      guardia.current = null;
      primaDelRouter.pop = null;
      window.removeEventListener("beforeunload", ricarica);
    };
  }, [attivo, guardia, sporco]);

  const posizione = useMemo(() => (mostrata ? { location: mostrata, navigationType: tipo } : null), [mostrata, tipo]);
  const navigatore = guida?.navigatore;
  const dentro = useMemo(() => (navigatore ? { ...navigazione, navigator: navigatore } : null), [navigazione, navigatore]);

  if (!guida || !mostrata || !posizione || !dentro) return null;
  const qui = `${mostrata.pathname}${mostrata.search}${mostrata.hash}`;
  const stadio = uscita ? "uscita" : "aperto";

  return createPortal(
    <DentroPannello.Provider value>
      <NavigationContext.Provider value={dentro}>
        <LocationContext.Provider value={posizione}>
          <RouteContext.Provider value={CONTESTO_VUOTO}>
            <PostoPercorso.Provider value={posto}>
              <div
                aria-hidden="true"
                data-pannello-fuori
                data-stato={stadio}
                className="pannello-velo"
                onClick={() => {
                  if (!premutoConPopup.current && Date.now() - apertoDa.current > SORDO_MS) chiudi();
                }}
              />
              <section
                ref={foglio}
                role="dialog"
                aria-modal="true"
                aria-label="Scheda"
                tabIndex={-1}
                inert={uscita || undefined}
                data-pannello
                data-stato={stadio}
                className="pannello-foglio"
                onInput={(e) => {
                  const t = e.target as Element;
                  if (foglio.current?.contains(t) && t.closest("form")) formToccato.current = true;
                }}
                onSubmit={() => {
                  formToccato.current = false;
                }}
              >
                <header className="flex h-testata shrink-0 items-center gap-1 border-b border-line px-3">
                  {(stato?.passo ?? 1) > 1 ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Indietro" data-pannello-indietro className="text-mute-deco hover:text-ink" onClick={guida.indietro}>
                      <ArrowLeft className="size-4" />
                    </Button>
                  ) : null}
                  <div ref={setPosto} data-pannello-percorso className="flex min-w-0 flex-1 items-center overflow-hidden text-ink2 [&>[data-slot=separator]]:hidden" />
                  <LinkBase to={qui} state={{ intera: true }} replace={false} data-pannello-intera className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 text-ink2")}>
                    <Maximize2 className="size-3.5" />
                    Apri a tutta pagina
                  </LinkBase>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Chiudi" data-pannello-chiudi className="shrink-0 text-mute-deco hover:text-ink" onClick={chiudi}>
                    <X className="size-4" />
                  </Button>
                </header>
                {}
                <div key={mostrata.pathname} data-pannello-corpo className="flex min-h-0 flex-1 flex-col overflow-auto overscroll-contain">
                  <ErrorBoundary
                    fallbackRender={() => (
                      <p role="alert" className="m-6 rounded-lg border border-line p-4 text-ink2">
                        Questa scheda non si è aperta. La pagina sotto è rimasta com'era.
                      </p>
                    )}
                  >
                    <Suspense fallback={<Attesa etichetta="Carico la scheda" />}>
                      <Schede />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </section>
              {inAttesa ? (
                <Dialog open onOpenChange={(si) => !si && setInAttesa(null)}>
                  <DialogContent data-richiesta="non-salvato" showCloseButton={false}>
                    <DialogHeader>
                      <DialogTitle>Hai un testo non salvato</DialogTitle>
                      <DialogDescription>Se esci da questa scheda, quello che hai scritto si perde.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const continua = inAttesa;
                          setInAttesa(null);
                          formToccato.current = false;
                          lascia.current = true;
                          continua();
                        }}
                      >
                        Esci senza salvare
                      </Button>
                      <Button onClick={() => setInAttesa(null)}>Continua a scrivere</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}
            </PostoPercorso.Provider>
          </RouteContext.Provider>
        </LocationContext.Provider>
      </NavigationContext.Provider>
    </DentroPannello.Provider>,
    document.body,
  );
};
