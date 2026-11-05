import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import type { DatiCrm } from "@/providers/dati";
import { RichiestaMotivo, RichiestaPasso } from "./Richieste";
import { CHIAVE_BACHECA } from "./useBacheca";
import type { FaseRiga, Trattativa } from "./tipi";

interface InAttesa {
  t: Trattativa;
  fase: FaseRiga;
  altro?: Record<string, unknown>;
}

export const faseDiPartenza = (fasi: FaseRiga[], percorso: string) =>
  fasi.filter((f) => f.percorso === percorso && f.tipo === "aperta").sort((a, b) => a.ordine - b.ordine)[0];

export const useSposta = (fasi: FaseRiga[]) => {
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const [inAttesa, setInAttesa] = useState<InAttesa | null>(null);

  const salva = useCallback(
    async ({ t, fase, altro: insieme }: InAttesa, altro: Record<string, unknown>) => {
      const dati = { fase_id: fase.id, ...insieme, ...altro };
      setInAttesa(null);
      await qc.cancelQueries({ queryKey: CHIAVE_BACHECA });
      qc.setQueriesData<Trattativa[]>({ queryKey: CHIAVE_BACHECA }, (righe) =>
        righe?.map((x) => (x.id === t.id ? { ...x, ...dati } : x)),
      );
      try {
        await dp.patch("trattative", { id: t.id, data: dati });
        const da = fasi.find((f) => f.id === t.fase_id)?.nome ?? t.fase_id;
        await dp.create("attivita", {
          data: {
            tipo: "fase",
            trattativa_id: t.id,
            azienda_id: t.azienda_id,
            persona_id: t.persona_id,
            fase: fase.id,
            testo: `${da} → ${fase.nome}`,
          },
        });
      } catch (e) {
        notify(`La trattativa non si è spostata: ${e instanceof Error ? e.message : "errore del servizio"}`, { type: "error" });
      } finally {
        void qc.invalidateQueries({ queryKey: ["trattative"] });
        void qc.invalidateQueries({ queryKey: ["attivita"] });
        void qc.invalidateQueries({ queryKey: ["elenco-trattative"] });
      }
    },
    [dp, fasi, notify, qc],
  );

  const sposta = useCallback(
    (t: Trattativa, faseId: string, altro?: Record<string, unknown>) => {
      const fase = fasi.find((f) => f.id === faseId);
      if (!fase || (t.fase_id === faseId && !altro)) return;
      if (fase.tipo === "cliente") void salva({ t, fase, altro }, {});
      else setInAttesa({ t, fase, altro });
    },
    [fasi, salva],
  );

  const annulla = useCallback(() => setInAttesa(null), []);

  const dialogo = !inAttesa ? null : inAttesa.fase.tipo === "perso" ? (
    <RichiestaMotivo key={inAttesa.t.id} {...inAttesa} onAnnulla={annulla} onConferma={(d) => void salva(inAttesa, d)} />
  ) : (
    <RichiestaPasso key={inAttesa.t.id} {...inAttesa} onAnnulla={annulla} onConferma={(d) => void salva(inAttesa, d)} />
  );

  return { sposta, inAttesa, dialogo };
};
