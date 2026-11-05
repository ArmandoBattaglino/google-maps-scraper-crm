import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DatiInteressato } from "./Interessato";
import {
  apriDaInteressato,
  haCarta,
  prossima as chiediProssima,
  rilascia,
  scriviEsito,
  type Esito,
  type Prossima,
  type Sorgente,
} from "./api";

export type Sessione = Record<Esito, number>;
const NESSUNA: Sessione = { "non-risponde": 0, richiamare: 0, "non-interessato": 0, interessato: 0 };
const RIPROVA_MS = 20_000;

export const useCoda = (sorgente: Sorgente) => {
  const qc = useQueryClient();
  const [sessione, setSessione] = useState<Sessione>(NESSUNA);
  const [nota, setNota] = useState("");
  const chiamataDa = useRef<number | null>(null);
  const [attuale, setAttuale] = useState<Prossima>();

  const carta = useMutation({
    mutationFn: () => chiediProssima(sorgente),
    onSuccess: (r) => {
      setAttuale(r);
      setNota("");
      chiamataDa.current = null;
    },
  });
  const passa = carta.mutate;
  const azienda = haCarta(attuale) ? attuale.azienda : null;

  useEffect(() => {
    passa();
    const via = () => rilascia();
    window.addEventListener("pagehide", via);
    return () => {
      window.removeEventListener("pagehide", via);
      rilascia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inManoAltrui = attuale && !azienda && attuale.in_coda > 0;
  useEffect(() => {
    if (!inManoAltrui) return;
    const t = setInterval(() => passa(), RIPROVA_MS);
    return () => clearInterval(t);
  }, [inManoAltrui, passa]);

  const rileggi = useCallback(() => {
    for (const r of ["aziende", "attivita", "compiti", "trattative"]) void qc.invalidateQueries({ queryKey: [r] });
  }, [qc]);

  const esito = useMutation({ mutationFn: scriviEsito });

  const registra = useCallback(
    (scelto: Esito, quando?: string) => {
      if (!azienda || esito.isPending || carta.isPending) return;
      const da = chiamataDa.current;
      esito.mutate(
        {
          azienda_id: azienda.id,
          esito: scelto,
          ...(quando ? { quando } : {}),
          ...(da ? { durata: Math.round((Date.now() - da) / 1000) } : {}),
          ...(nota.trim() ? { testo: nota.trim() } : {}),
        },
        {
          onSuccess: (r) => {
            setSessione((s) => ({ ...s, [scelto]: s[scelto] + (r.ripetuto ? 0 : 1) }));
            rileggi();
            passa();
          },
        },
      );
    },
    [azienda, esito, carta.isPending, nota, rileggi, passa],
  );

  const interessato = useCallback(
    async (d: DatiInteressato) => {
      if (!azienda) return;
      const da = chiamataDa.current;
      await apriDaInteressato({ azienda_id: azienda.id, ...d, chiamata: da ? { durata: Math.round((Date.now() - da) / 1000) } : {} });
      setSessione((s) => ({ ...s, interessato: s.interessato + 1 }));
      toast.success("Trattativa aperta");
      rileggi();
      passa();
    },
    [azienda, rileggi, passa],
  );

  return {
    carta,
    attuale,
    sessione,
    nota,
    setNota,
    registra,
    esito,
    interessato,
    segnaChiamata: () => {
      chiamataDa.current ??= Date.now();
    },
  };
};
