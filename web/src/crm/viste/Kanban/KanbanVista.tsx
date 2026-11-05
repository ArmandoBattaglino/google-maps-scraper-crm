import { AzioniRiga, useAzioniRiga } from "@/crm/azioni/MenuRiga";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { useSoci } from "@/crm/soci";
import { Bacheca } from "@/crm/trattative/Bacheca";
import type { DatiCarta } from "@/crm/trattative/Carta";
import { useGiornoRoma, useSoglie } from "@/crm/trattative/Fermo";
import { NuovaTrattativa } from "@/crm/trattative/NuovaTrattativa";
import type { FaseRiga, Trattativa } from "@/crm/trattative/tipi";
import { useFasi } from "@/crm/trattative/useBacheca";
import { useSposta } from "@/crm/trattative/useSposta";
import { cn } from "@/lib/utils";
import type { DatiCrm } from "@/providers/dati";
import { messaggioDi } from "../Barra/forme";
import { colonneTitolo, titoloDi } from "../Calendario/eventi";
import { useContesto } from "../contesto";
import { colonneDi, leggiFinoA, type RigaVista } from "../dati";
import { pulisci } from "../Filtri/albero";
import { Errore, Puntini } from "../forme";
import { valoreDi } from "../formato";
import { calcolatoQui, corpoPatch, destinoDi } from "../Tabella/editor";
import type { StatoPagina } from "../useStatoVista";
import { CartaRiga, CartaRigaInVolo, ColonneCarta } from "./CartaRiga";
import { campoDelleColonne, colonneDelCampo, colonneDelleFasi, FASE, SENZA_VALORE } from "./colonne";

const MASSIMO = 2000;
const CAMPI_CARTA = ["azienda_id", "persona_id", "percorso", "fase_id", "valore", "prossimo_passo", "prossimo_il", "segue", "mossa_il", "motivo_perso", "archiviata_il", "creato", "azienda.nome", "persona.nome"];

export const KanbanVista = ({ pagina }: { pagina: StatoPagina }) => {
  const { stato } = pagina;
  const ctx = useContesto();
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const { percorsi, fasi } = useFasi();
  const { nomeDi } = useSoci();
  const sogliaDi = useSoglie();
  const oggi = useGiornoRoma();
  const campo = campoDelleColonne(ctx, stato.gruppi);
  const [spostate, setSpostate] = useState<Map<string, string>>(new Map());
  const [nuovaIn, setNuovaIn] = useState<FaseRiga | null>(null);

  const trattative = stato.risorsa === "trattative";
  const azioni = useAzioniRiga(stato.risorsa === "attivita" ? "aziende" : stato.risorsa);
  const colonneVista = useMemo(() => stato.colonne.map((c) => c.campo).filter((c) => c !== campo), [stato.colonne, campo]);
  const richiesta = useMemo(() => {
    const scelte = trattative ? CAMPI_CARTA : colonneDi({ ...stato, gruppi: [], campo_data: null }, colonneTitolo(stato.risorsa));
    return { filtri: pulisci(stato.filtri), ordine: [], colonne: [...new Set([...scelte, ...(campo ? [campo] : [])])] };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lo stato conta per filtri e colonne
  }, [stato.filtri, stato.colonne, stato.risorsa, trattative, campo]);
  const q = useQuery({
    queryKey: [stato.risorsa, "cerca", "kanban", richiesta],
    queryFn: ({ signal }) => leggiFinoA(stato.risorsa, richiesta, MASSIMO, signal),
    enabled: !!campo,
    retry: false,
  });
  const righe = useMemo(() => q.data?.righe ?? [], [q.data]);
  const perId = useMemo(() => new Map(righe.map((r) => [r.id, r])), [righe]);

  const sulleFasi = campo === FASE;
  const colonne = useMemo(
    () => (sulleFasi ? colonneDelleFasi(fasi, percorsi, righe) : colonneDelCampo(ctx, campo ?? "", righe.map((r) => valoreDi(r, campo ?? "")))),
    [sulleFasi, fasi, percorsi, righe, ctx, campo],
  );
  const { sposta: spostaFase, inAttesa, dialogo } = useSposta(sulleFasi ? colonne : []);

  const inBacheca = useMemo(
    () =>
      righe.map((r) => {
        const colonna = inAttesa?.t.id === r.id ? inAttesa.fase.id : (spostate.get(r.id) ?? (sulleFasi ? r.fase_id : (valoreDi(r, campo ?? "") ?? SENZA_VALORE)));
        return { ...(r as unknown as Trattativa), fase_id: String(colonna) };
      }),
    [righe, inAttesa, spostate, sulleFasi, campo],
  );

  const tipoVero = useMemo(() => new Map(fasi.map((f) => [f.id, f.tipo])), [fasi]);
  const datiDi = useCallback(
    (t: Trattativa): DatiCarta => {
      const r = perId.get(t.id) as RigaVista;
      if (!trattative) return { t, azienda: titoloDi(stato.risorsa, r), tipo: "aperta", soglia: null, oggi };
      const fase = String(r.fase_id);
      return {
        t,
        azienda: r["azienda.nome"] as string | undefined,
        persona: r["persona.nome"] as string | undefined,
        segue: nomeDi(t.segue),
        tipo: tipoVero.get(fase) ?? "aperta",
        soglia: sogliaDi(fase),
        oggi,
      };
    },
    [perId, trattative, stato.risorsa, nomeDi, tipoVero, sogliaDi, oggi],
  );

  const onSposta = useCallback(
    async (t: Trattativa, verso: string) => {
      const r = perId.get(t.id);
      if (!r || !campo) return;
      if (sulleFasi) return spostaFase(r as unknown as Trattativa, verso);
      if (t.fase_id === verso) return;
      if (campo === "stato") {
        notify("Lo stato segue la trattativa: si cambia dalla sua fase.", { type: "info" });
        return;
      }
      if (calcolatoQui(stato.risorsa, r, campo)) {
        notify("Qui è calcolato dalle trattative: si cambia dalla trattativa.", { type: "info" });
        return;
      }
      setSpostate((m) => new Map(m).set(t.id, verso));
      try {
        const valore = verso === SENZA_VALORE ? null : verso;
        const d = campo === "scheda.segue" ? destinoDi(stato.risorsa, r, campo, valore) : null;
        await (d ? dp.patch(d.risorsa, { id: d.id, data: d.data }) : dp.patch(stato.risorsa, { id: t.id, data: corpoPatch(stato.risorsa, r, campo, valore) }));
        await qc.invalidateQueries({ queryKey: [stato.risorsa] });
        if (d) await qc.invalidateQueries({ queryKey: [d.risorsa] });
      } catch (e) {
        notify(messaggioDi(e, "La carta non si è spostata"), { type: "error" });
      } finally {
        setSpostate((m) => {
          const n = new Map(m);
          n.delete(t.id);
          return n;
        });
      }
    },
    [perId, campo, sulleFasi, spostaFase, dp, qc, notify, stato.risorsa],
  );

  if (!campo) return <Errore messaggio="Qui non c'è un campo con valori chiusi per fare le colonne: aggiungine uno in Campi personalizzati." />;
  if (q.error) return <Errore messaggio={messaggioDi(q.error, "Le carte non si sono caricate.")} onRiprova={() => void q.refetch()} />;
  if (q.isPending) return <Puntini etichetta="Carico le carte" />;
  return (
    <div data-griglia="kanban" data-campo-colonne={campo} data-carte={righe.length} className={cn("flex min-h-0 flex-1 flex-col overflow-auto", !trattative && "[&_[data-totale-valore]]:hidden")}>
      {q.data.totale > righe.length ? (
        <p role="status" className="mx-6 mb-2 rounded-md bg-warn-soft px-3 py-1.5 text-warn">
          Qui ci sono le prime {righe.length} carte su {q.data.totale}: stringi i filtri per vederle tutte.
        </p>
      ) : null}
      {azioni.nodo}
      <AzioniRiga.Provider value={stato.risorsa === "attivita" ? null : azioni.apri}>
      <ColonneCarta.Provider value={colonneVista}>
        {}
        <Bacheca
          fasi={colonne}
          righe={inBacheca}
          datiDi={datiDi}
          onSposta={(t, v) => void onSposta(t, v)}
          onAggiungi={sulleFasi ? setNuovaIn : undefined}
          {...(trattative ? {} : { carta: CartaRiga, cartaInVolo: CartaRigaInVolo })}
        />
      </ColonneCarta.Provider>
      </AzioniRiga.Provider>
      {dialogo}
      {nuovaIn ? <NuovaTrattativa fase={nuovaIn} onChiudi={() => setNuovaIn(null)} /> : null}
    </div>
  );
};
