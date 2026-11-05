import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import {
  BrowserRouter,
  parsePath,
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_NavigationContext as NavigationContext,
  useLocation,
  useNavigate,
  useNavigationType,
  type Location,
  type Navigator,
  type To,
} from "react-router";
import { restaNelPannello, senzaPannello, siApreNelPannello, statoDi, type StatoPannello } from "./percorsi";

export type Guardia = (continua: () => void) => boolean;

export interface GuidaPannello {
  vera: Location;
  stato: StatoPannello | null;
  navigatore: Navigator;
  chiudi: () => void;
  indietro: () => void;
  guardia: RefObject<Guardia | null>;
  daRidare: RefObject<HTMLElement | null>;
}

export const primaDelRouter: { pop: ((e: PopStateEvent) => void) | null } = { pop: null };
window.addEventListener("popstate", (e) => primaDelRouter.pop?.(e));

const Guida = createContext<GuidaPannello | null>(null);
export const usePannello = () => useContext(Guida);

export const DentroPannello = createContext(false);

export const useChiudiScheda = () => {
  const dentro = useContext(DentroPannello);
  const guida = usePannello();
  const navigate = useNavigate();
  return (lista: string) => (dentro && guida ? guida.chiudi() : navigate(lista));
};

interface StoriaDelBrowser extends Navigator {
  location: Location;
}

const creaNavigatori = (base: StoriaDelBrowser, basename: string, guardia: RefObject<Guardia | null>, daRidare: RefObject<HTMLElement | null>) => {
  const percorso = (nome: string) => (basename !== "/" && nome.startsWith(basename) ? nome.slice(basename.length) || "/" : nome);
  const conBase = (nome: string) => (basename === "/" ? nome : `${basename}${nome === "/" ? "" : nome}`);
  const verso = (to: To) => (typeof to === "string" ? parsePath(to) : to);
  const qui = (): Location => {
    const l = base.location;
    return { pathname: percorso(l.pathname), search: l.search, hash: l.hash, state: l.state, key: l.key };
  };
  const stato = () => statoDi(qui());
  const protetta = (fai: () => void) => {
    if (!guardia.current?.(fai)) fai();
  };

  const stessa = (to: To) => {
    const d = verso(to);
    const q = qui();
    return percorso(d.pathname ?? q.pathname) === q.pathname && (d.search ?? "") === q.search;
  };

  const pannello: StoriaDelBrowser = Object.create(base) as StoriaDelBrowser;
  pannello.push = (to, state, opzioni) => {
    const { intera, ...resto } = (state ?? {}) as { intera?: boolean } & Record<string, unknown>;
    const ora = stato();
    if (intera || !ora) return protetta(() => base.push(to, intera ? resto : state, opzioni));
    if (stessa(to)) return;
    if (restaNelPannello(percorso(verso(to).pathname ?? ""))) return protetta(() => base.push(to, { ...resto, sfondo: ora.sfondo, passo: ora.passo + 1 }, opzioni));
    protetta(() => base.push(to, state, opzioni));
  };
  pannello.replace = (to, state, opzioni) => {
    const ora = stato();
    if ((state as { intera?: boolean } | null)?.intera) return protetta(() => base.replace(to, null, opzioni));
    if (ora && restaNelPannello(percorso(verso(to).pathname ?? ""))) return base.replace(to, { ...((state ?? {}) as object), sfondo: ora.sfondo, passo: ora.passo }, opzioni);
    base.replace(to, state, opzioni);
  };

  const cambiaSfondo = (ora: StatoPannello, to: To, state: unknown) => {
    const d = verso(to);
    const l = base.location;
    const nome = d.pathname ? percorso(d.pathname) : ora.sfondo.pathname;
    const sfondo = { ...ora.sfondo, pathname: nome, search: d.search ?? "", hash: d.hash ?? "", state: state ?? null };
    base.replace({ pathname: l.pathname, search: l.search, hash: l.hash }, { ...(l.state as object), sfondo, sfondoCambiato: true });
  };

  const sotto: StoriaDelBrowser = Object.create(base) as StoriaDelBrowser;
  sotto.push = (to, state, opzioni) => {
    const nome = percorso(verso(to).pathname ?? "");
    const ora = stato();
    if (ora) return restaNelPannello(nome) ? pannello.push(to, state, opzioni) : cambiaSfondo(ora, to, state);
    if (!siApreNelPannello(nome) || senzaPannello(qui().pathname)) return base.push(to, state, opzioni);
    daRidare.current = document.activeElement as HTMLElement | null;
    base.push(to, { ...((state ?? {}) as object), sfondo: qui(), passo: 1 }, opzioni);
  };
  sotto.replace = (to, state, opzioni) => {
    const ora = stato();
    if (!ora) return base.replace(to, state, opzioni);
    if (restaNelPannello(percorso(verso(to).pathname ?? ""))) return pannello.replace(to, state, opzioni);
    cambiaSfondo(ora, to, state);
  };

  const scriviSfondo = (s: Location) => base.replace({ pathname: conBase(s.pathname), search: s.search, hash: s.hash }, s.state);

  const chiudi = () => {
    const ora = stato();
    if (!ora) return;
    protetta(() => {
      const indice = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (indice >= ora.passo) base.go(-ora.passo);
      else scriviSfondo(ora.sfondo);
    });
  };
  const indietro = () => protetta(() => base.go(-1));

  return { pannello, sotto, chiudi, indietro, scriviSfondo };
};

export const RouterConPannello = ({ basename, children }: { basename: string; children: ReactNode }) => (
  <BrowserRouter basename={basename}>
    <InstradamentoPannello>{children}</InstradamentoPannello>
  </BrowserRouter>
);

const InstradamentoPannello = ({ children }: { children: ReactNode }) => {
  const vera = useLocation();
  const tipo = useNavigationType();
  const nav = useContext(NavigationContext);
  const guardia = useRef<Guardia | null>(null);
  const daRidare = useRef<HTMLElement | null>(null);

  const navigatori = useMemo(() => creaNavigatori(nav.navigator as StoriaDelBrowser, nav.basename, guardia, daRidare), [nav.navigator, nav.basename]);
  const stato = statoDi(vera);
  const sfondo = stato?.sfondo ?? vera;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ⭐ deve restare lo STESSO oggetto finché la pagina sotto è la stessa: è ciò che la tiene ferma
  const posizione = useMemo(() => ({ location: sfondo, navigationType: tipo }), [sfondo.key, sfondo.pathname, sfondo.search, sfondo.hash]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nav è stabile: cambia solo il navigatore, una volta
  const navigazione = useMemo(() => ({ ...nav, navigator: navigatori.sotto }), [nav.basename, nav.navigator, navigatori]);
  const guida = useMemo<GuidaPannello>(
    () => ({ vera, stato, navigatore: navigatori.pannello, chiudi: navigatori.chiudi, indietro: navigatori.indietro, guardia, daRidare }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stato si ricava da vera
    [vera, navigatori],
  );

  const prima = useRef(vera);
  useLayoutEffect(() => {
    const p = statoDi(prima.current);
    prima.current = vera;
    if (p?.sfondoCambiato && !statoDi(vera) && vera.key === p.sfondo.key) navigatori.scriviSfondo(p.sfondo);
  }, [vera, navigatori]);

  return (
    <Guida.Provider value={guida}>
      <NavigationContext.Provider value={navigazione}>
        <LocationContext.Provider value={posizione}>{children}</LocationContext.Provider>
      </NavigationContext.Provider>
    </Guida.Provider>
  );
};
