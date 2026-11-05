import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useGetList } from "ra-core";
import { giorniDa, giornoRoma } from "@/crm/tempo";
import type { FaseRiga, Trattativa } from "./tipi";

const SOGLIA_DI_BASE = 7;
const ANNI_100 = 36500;
const CHIAVI = "soglia_ferma_giorni,soglie_ferma_fasi";
const DUE_RIGHE = { page: 1, perPage: 2 };
const PER_CHIAVE = { field: "chiave", order: "ASC" as const };

const sogliaValida = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= ANNI_100;

interface Impostazione {
  id: string;
  chiave: string;
  valore: unknown;
}

export const useSoglie = () => {
  const { data } = useGetList<Impostazione>("impostazioni", {
    filter: { "chiave@in": CHIAVI },
    pagination: DUE_RIGHE,
    sort: PER_CHIAVE,
  });
  const lette = useMemo(() => {
    if (!data) return null;
    const valore = (k: string) => data.find((r) => r.chiave === k)?.valore;
    const base = valore("soglia_ferma_giorni");
    const perFase = valore("soglie_ferma_fasi");
    return {
      base: sogliaValida(base) ? base : SOGLIA_DI_BASE,
      mappa: perFase && typeof perFase === "object" && !Array.isArray(perFase) ? (perFase as Record<string, unknown>) : {},
    };
  }, [data]);
  return useCallback(
    (fase: string): number | null => {
      if (!lette) return null;
      const s = Object.hasOwn(lette.mappa, fase) ? lette.mappa[fase] : undefined;
      return sogliaValida(s) ? s : lette.base;
    },
    [lette],
  );
};

const ogniMinuto = (avvisa: () => void) => {
  const t = setInterval(avvisa, 60_000);
  return () => clearInterval(t);
};

export const useGiornoRoma = (): string => useSyncExternalStore(ogniMinuto, giornoRoma);

export const giorniFerma = (
  t: Pick<Trattativa, "mossa_il" | "archiviata_il">,
  tipo: FaseRiga["tipo"] | undefined,
  soglia: number | null,
  oggi: string,
): number | null => {
  if (tipo !== "aperta" || t.archiviata_il || soglia === null) return null;
  const g = giorniDa(t.mossa_il, oggi);
  return g >= soglia ? g : null;
};

export const Fermo = ({ giorni }: { giorni: number }) => (
  <span data-fermo={giorni} className="rounded-sm bg-warn-soft px-[7px] py-px font-medium whitespace-nowrap text-warn">
    ferma da {giorni} {giorni === 1 ? "giorno" : "giorni"}
  </span>
);

export const quandoMossa = (iso: string, oggi: string): string => {
  const g = giorniDa(iso, oggi);
  if (g === 0) return "oggi";
  return g === 1 ? "ieri" : `${g} giorni fa`;
};
