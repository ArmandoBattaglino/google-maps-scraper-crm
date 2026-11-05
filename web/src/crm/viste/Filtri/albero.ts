import type { Condizione, Gruppo, Nodo } from "../stato";

export const MAX_PROFONDITA = 5;

export const eGruppo = (n: Nodo): n is Gruppo => "e" in n || "o" in n;
export const legame = (g: Gruppo): "e" | "o" => ("e" in g ? "e" : "o");
export const figli = (g: Gruppo): Nodo[] => ("e" in g ? g.e : g.o);
const conFigli = (g: Gruppo, nuovi: Nodo[]): Gruppo => (legame(g) === "e" ? { e: nuovi } : { o: nuovi });
export const cambiaLegame = (g: Gruppo, l: "e" | "o"): Gruppo => (l === "e" ? { e: figli(g) } : { o: figli(g) });

export const SENZA_VALORE = new Set(["vuoto", "non_vuoto", "tutte"]);
export const DI_GIORNI = new Set(["negli_ultimi_giorni", "entro_giorni"]);
export const ELENCHI = new Set(["in", "non_in"]);

const pieno = (v: unknown) => v !== undefined && v !== null && v !== "";

export const completa = (c: Condizione): boolean => {
  if (!c.campo || !c.op) return false;
  if (SENZA_VALORE.has(c.op)) return true;
  if (c.op === "tra") return Array.isArray(c.valore) && c.valore.length === 2 && c.valore.every(pieno);
  if (ELENCHI.has(c.op)) return Array.isArray(c.valore) && c.valore.length > 0;
  return pieno(c.valore);
};

export const pulisci = (g: Gruppo): Gruppo =>
  conFigli(
    g,
    figli(g).flatMap((n): Nodo[] => {
      if (!eGruppo(n)) {
        if (!completa(n)) return [];
        return [SENZA_VALORE.has(n.op) ? { campo: n.campo, op: n.op } : n];
      }
      const p = pulisci(n);
      return figli(p).length ? [p] : [];
    }),
  );

export const inPercorso = (g: Gruppo, percorso: number[]): Nodo => percorso.reduce<Nodo>((n, i) => figli(n as Gruppo)[i], g);

export const sostituisci = (g: Gruppo, percorso: number[], nuovo: Nodo | null): Gruppo => {
  const [i, ...resto] = percorso;
  const lista = [...figli(g)];
  if (!resto.length) {
    if (nuovo) lista[i] = nuovo;
    else lista.splice(i, 1);
  } else {
    lista[i] = sostituisci(lista[i] as Gruppo, resto, nuovo);
  }
  return conFigli(g, lista);
};

export const aggiungi = (g: Gruppo, percorso: number[], nuovo: Nodo): Gruppo => {
  if (!percorso.length) return conFigli(g, [...figli(g), nuovo]);
  const dentro = inPercorso(g, percorso) as Gruppo;
  return sostituisci(g, percorso, conFigli(dentro, [...figli(dentro), nuovo]));
};

export const contaCondizioni = (g: Gruppo): number => figli(g).reduce((s, n) => s + (eGruppo(n) ? contaCondizioni(n) : 1), 0);

export const ANCHE_NON_AZIENDE: Condizione = { campo: "etichetta", op: "tutte" };
export const parlaDiEtichetta = (g: Gruppo): boolean => figli(g).some((n) => (eGruppo(n) ? parlaDiEtichetta(n) : n.campo === "etichetta"));

export const conAncheFiltro = (g: Gruppo, ...altre: Nodo[]): Gruppo => ({ e: [...(figli(g).length ? [g] : []), ...altre] });
