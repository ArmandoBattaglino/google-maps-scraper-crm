import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import type { Trattativa } from "@/crm/trattative/tipi";
import { useFasi } from "@/crm/trattative/useBacheca";
import { faseDiPartenza, useSposta } from "@/crm/trattative/useSposta";
import type { DatiCrm } from "@/providers/dati";
import { messaggioDi } from "../Barra/forme";
import type { RigaVista } from "../dati";
import { valoreDi } from "../formato";
import type { Risorsa } from "../stato";
import type { Opzione } from "../etichette";
import { calcolatoQui, destinoDi, eFase } from "./editor";

interface Modifica {
  valore: (riga: RigaVista, campo: string) => unknown;
  salva: (riga: RigaVista, campo: string, valore: unknown) => Promise<void>;
  opzioniFase: (riga: RigaVista) => Opzione[];
  erroreDi: (riga: RigaVista, campo: string) => string | undefined;
}

const Ctx = createContext<Modifica | null>(null);

export const useModifica = (): Modifica => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useModifica fuori da <FornitoreModifica>");
  return c;
};

const chiaveDi = (id: string, campo: string) => `${id}|${campo}`;

export const FornitoreModifica = ({ risorsa, children }: { risorsa: Risorsa; children: ReactNode }) => {
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const [scritti, setScritti] = useState<Map<string, unknown>>(new Map());
  const [errori, setErrori] = useState<Map<string, string>>(new Map());
  const { fasi } = useFasi();
  const { sposta, dialogo } = useSposta(fasi);
  const opzioniFase = useCallback(
    (riga: RigaVista) => fasi.filter((f) => f.percorso === riga.percorso).map((f) => ({ valore: f.nome, etichetta: f.nome })),
    [fasi],
  );

  const togli = useCallback(<T,>(set: (f: (m: Map<string, T>) => Map<string, T>) => void, k: string) => {
    set((m) => {
      if (!m.has(k)) return m;
      const n = new Map(m);
      n.delete(k);
      return n;
    });
  }, []);

  const salva = useCallback(
    async (riga: RigaVista, campo: string, valore: unknown) => {
      if (calcolatoQui(risorsa, riga, campo)) {
        notify("Qui è calcolato dalle trattative: si cambia dalla trattativa.", { type: "info" });
        return;
      }
      if (risorsa === "trattative" && eFase(campo)) {
        const fase = fasi.find((f) => (campo === "fase_id" ? f.id === valore : f.nome === valore && f.percorso === riga.percorso));
        if (fase) sposta(riga as unknown as Trattativa, fase.id);
        return;
      }
      if (risorsa === "trattative" && campo === "percorso") {
        const fase = valore ? faseDiPartenza(fasi, String(valore)) : undefined;
        if (fase && valore !== riga.percorso) sposta(riga as unknown as Trattativa, fase.id, { percorso: valore });
        return;
      }
      const k = chiaveDi(riga.id, campo);
      togli(setErrori, k);
      const senzaAnteprima = campo === "valore" || campo === "azienda.nome" || campo === "persona.nome";
      if (!senzaAnteprima) setScritti((m) => new Map(m).set(k, valore));
      try {
        const d = destinoDi(risorsa, riga, campo, valore);
        if (!d) throw new Error("Qui non c'è niente di collegato da modificare");
        await dp.patch(d.risorsa, { id: d.id, data: d.data });
        await qc.invalidateQueries({ queryKey: [risorsa] });
        if (d.risorsa !== risorsa) await qc.invalidateQueries({ queryKey: [d.risorsa] });
      } catch (e) {
        const messaggio = messaggioDi(e, "Il valore non si è salvato");
        setErrori((m) => new Map(m).set(k, messaggio));
        notify(messaggio, { type: "error" });
      } finally {
        togli(setScritti, k);
      }
    },
    [dp, qc, notify, risorsa, togli, fasi, sposta],
  );

  const valore = useCallback(
    (riga: RigaVista, campo: string) => {
      const k = chiaveDi(riga.id, campo);
      return scritti.has(k) ? scritti.get(k) : valoreDi(riga, campo);
    },
    [scritti],
  );
  const erroreDi = useCallback((riga: RigaVista, campo: string) => errori.get(chiaveDi(riga.id, campo)), [errori]);

  const m = useMemo(() => ({ valore, salva, erroreDi, opzioniFase }), [valore, salva, erroreDi, opzioniFase]);
  return (
    <Ctx.Provider value={m}>
      {children}
      {dialogo}
    </Ctx.Provider>
  );
};
