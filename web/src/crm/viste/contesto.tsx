import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useSoci } from "@/crm/soci";
import type { TonoChip } from "@/components/crm/forme";
import { toniDelleFasi } from "@/crm/trattative/tipi";
import { useFasi } from "@/crm/trattative/useBacheca";
import { useCatalogo, type VoceCampo } from "./dati";
import { nascosto, nomeColonna, opzioniFisse, type Opzione } from "./etichette";
import type { Risorsa } from "./stato";

export interface Contesto {
  risorsa: Risorsa;
  campi: VoceCampo[];
  inCaricamento: boolean;
  errore: Error | null;
  voce: (campo: string) => VoceCampo | undefined;
  nome: (campo: string) => string;
  opzioniDi: (campo: string) => Opzione[] | null;
  tonoFase: (fase: string) => TonoChip;
  etichettaDi: (campo: string, valore: unknown) => string;
}

const Ctx = createContext<Contesto | null>(null);

export const useContesto = (): Contesto => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useContesto fuori da <FornitoreContesto>");
  return c;
};

const SOCI = new Set(["segue", "scheda.segue", "creato_da", "chiamato_da", "trattativa.segue"]);

export const campoDiSocio = (campo: string) => SOCI.has(campo);
export const eSocio = (campo: string, valore: unknown) =>
  Boolean(valore) && SOCI.has(campo) && (campo !== "creato_da" || String(valore).includes("@"));

const valoreOpzione = (o: string | { valore: string }) => (typeof o === "string" ? o : o.valore);

export const FornitoreContesto = ({ risorsa, children }: { risorsa: Risorsa; children: ReactNode }) => {
  const catalogo = useCatalogo(risorsa);
  const { fasi, percorsi } = useFasi();
  const { soci, nomeDi } = useSoci();

  const campi = useMemo(
    () =>
      (catalogo.data ?? []).filter(
        (c) => c.tipo !== "uuid" && !nascosto(c.campo) && c.campo !== "azienda.esito" && !(c.campo === "esito" && risorsa !== "attivita"),
      ),
    [catalogo.data, risorsa],
  );
  const perNome = useMemo(() => new Map((catalogo.data ?? []).map((c) => [c.campo, c])), [catalogo.data]);

  const opzioniDi = useCallback(
    (campo: string): Opzione[] | null => {
      const fissa = opzioniFisse(risorsa, campo);
      if (fissa) return fissa;
      const v = perNome.get(campo);
      if (v?.opzioni?.length) return v.opzioni.map((o) => ({ valore: valoreOpzione(o), etichetta: valoreOpzione(o) }));
      if (campo === "percorso" && risorsa === "trattative") return percorsi.map((p) => ({ valore: p.id, etichetta: p.nome }));
      if (campo === "fase_id") return fasi.map((f) => ({ valore: f.id, etichetta: f.nome }));
      if (campo === "stato") {
        const nomi = [...fasi.map((f) => f.nome), ...(opzioniFisse("aziende", "esito") ?? []).map((o) => o.etichetta)];
        return [...new Set(nomi)].map((n) => ({ valore: n, etichetta: n }));
      }
      if (campo === "fase.nome") return [...new Set(fasi.map((f) => f.nome))].map((n) => ({ valore: n, etichetta: n }));
      if (SOCI.has(campo)) return soci.map((s) => ({ valore: s.email, etichetta: s.nome || s.email }));
      return null;
    },
    [risorsa, perNome, fasi, percorsi, soci],
  );

  const nome = useCallback((campo: string) => perNome.get(campo)?.etichetta ?? nomeColonna(campo, risorsa), [perNome, risorsa]);

  const etichettaDi = useCallback(
    (campo: string, valore: unknown): string => {
      if (valore === null || valore === undefined || valore === "") return "";
      if (SOCI.has(campo)) return nomeDi(String(valore));
      return opzioniDi(campo)?.find((o) => o.valore === valore)?.etichetta ?? String(valore);
    },
    [opzioniDi, nomeDi],
  );

  const toni = useMemo(() => toniDelleFasi(fasi), [fasi]);

  const contesto = useMemo<Contesto>(
    () => ({
      risorsa,
      tonoFase: (fase) => toni.get(fase) ?? "neutro",
      campi,
      inCaricamento: catalogo.isPending,
      errore: catalogo.error,
      voce: (campo) => perNome.get(campo),
      nome,
      opzioniDi,
      etichettaDi,
    }),
    [toni, risorsa, campi, catalogo.isPending, catalogo.error, perNome, nome, opzioniDi, etichettaDi],
  );
  return <Ctx.Provider value={contesto}>{children}</Ctx.Provider>;
};
