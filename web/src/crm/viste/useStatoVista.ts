import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { PRIMA_ENTITA } from "@/crm/entita";
import { segnaUso, useViste } from "./dati";
import { leggiStato, RISORSE, scriviStato, statiUguali, statoDiPartenza, statoDiVista, type Risorsa, type StatoVista, type Vista, type Colonna } from "./stato";

const risorsaDa = (r: string | null, conStato: boolean): Risorsa => {
  if (RISORSE.includes(r as Risorsa)) return r as Risorsa;
  return conStato ? "aziende" : PRIMA_ENTITA;
};
const chiaveMie = (r: Risorsa) => `crm.viste.colonne.${r}`;

export const conColonneMie = (s: StatoVista): StatoVista => {
  try {
    const mie = JSON.parse(localStorage.getItem(chiaveMie(s.risorsa)) ?? "null") as Colonna[] | null;
    return Array.isArray(mie) && mie.length && mie.every((c) => typeof c?.campo === "string") ? { ...s, colonne: mie } : s;
  } catch {
    return s;
  }
};

const contate = new Set<string>();

export const useStatoVista = () => {
  const [parametri, setParametri] = useSearchParams();
  const { data: viste, isPending, error } = useViste();
  const idVista = parametri.get("vista");
  const risorsaChiesta = parametri.get("r");
  const testo = parametri.get("s");
  const [versioneMie, setVersioneMie] = useState(0);
  const vista: Vista | undefined = idVista ? viste?.find((v) => v.id === idVista) : undefined;

  const conStato = !!testo;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versioneMie: le colonne stanno nel browser, non nelle dipendenze
  const base = useMemo(() => (vista ? statoDiVista(vista) : conColonneMie(statoDiPartenza(risorsaDa(risorsaChiesta, conStato)))), [versioneMie, vista, risorsaChiesta, conStato]);
  const stato = useMemo(() => leggiStato(testo, base), [testo, base]);

  useEffect(() => {
    if (!vista || contate.has(vista.id)) return;
    contate.add(vista.id);
    segnaUso(vista.id);
    return () => {
      setTimeout(() => contate.delete(vista.id), 1000);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- conta l'apertura di quell'id, non ogni nuova copia della riga
  }, [vista?.id]);

  const cambia = useCallback(
    (nuovo: Partial<StatoVista>) => {
      const dopo = { ...stato, ...nuovo };
      setParametri(
        (p) => {
          if (!p.has("vista")) p.set("r", dopo.risorsa);
          if (statiUguali(dopo, base)) p.delete("s");
          else p.set("s", scriviStato(dopo));
          return p;
        },
        { replace: true },
      );
    },
    [stato, base, setParametri],
  );

  const sistemaColonne = useCallback(
    (colonne: Colonna[]) => {
      if (vista) return cambia({ colonne });
      try {
        localStorage.setItem(chiaveMie(stato.risorsa), JSON.stringify(colonne));
      } catch {
      }
      setVersioneMie((v) => v + 1);
      const dopo = { ...stato, colonne };
      setParametri(
        (p) => {
          p.set("r", dopo.risorsa);
          if (statiUguali(dopo, { ...base, colonne })) p.delete("s");
          else p.set("s", scriviStato(dopo));
          return p;
        },
        { replace: true },
      );
    },
    [vista, cambia, stato, base, setParametri],
  );

  const apri = useCallback(
    (quale: { vista: string } | { risorsa: Risorsa }) => setParametri("vista" in quale ? { vista: quale.vista } : { r: quale.risorsa }),
    [setParametri],
  );

  const annulla = useCallback(() => {
    setParametri(
      (p) => {
        if (!p.has("vista")) p.set("r", stato.risorsa);
        p.delete("s");
        return p;
      },
      { replace: true },
    );
  }, [stato.risorsa, setParametri]);

  return {
    stato,
    vista,
    viste: viste ?? [],
    inCaricamento: !!idVista && isPending,
    errore: error,
    vistaMancante: !!idVista && !isPending && !error && !vista,
    modificata: !statiUguali(stato, base),
    cambia,
    sistemaColonne,
    apri,
    annulla,
  };
};

export type StatoPagina = ReturnType<typeof useStatoVista>;
