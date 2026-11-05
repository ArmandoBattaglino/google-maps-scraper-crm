import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AzioniRiga, useAzioniRiga } from "@/crm/azioni/MenuRiga";
import type { DatiCrm } from "@/providers/dati";
import { useCallback, useMemo, useState } from "react";
import { Plus, SquareKanban, Table2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { PillolaFiltro } from "@/components/crm/forme";
import { Button } from "@/components/ui/button";
import { Testata } from "@/layout/Testata";
import { ScegliColonne } from "@/crm/colonne/ScegliColonne";
import { useCampiColonne } from "@/crm/colonne/useCampiColonne";
import type { Ordine } from "@/crm/colonne/TabellaCrm";
import { useColonne } from "@/crm/colonne/useColonne";
import { Scelta } from "@/crm/Scelta";
import { Segmenti } from "@/crm/Segmenti";
import { useSoci } from "@/crm/soci";
import { SceltaFiltroTag, useTagCambiato } from "@/crm/tag";
import { Bacheca } from "./Bacheca";
import type { DatiCarta } from "./Carta";
import { colonneTrattative, Elenco, useElencoTrattative, type RigaElenco } from "./Elenco";
import { useGiornoRoma, useSoglie } from "./Fermo";
import { NuovaTrattativa } from "./NuovaTrattativa";
import { euro, numero, type FaseRiga, type Trattativa } from "./tipi";
import { useBacheca, useFasi, usePercorsiUsati } from "./useBacheca";
import { useSposta } from "./useSposta";

const Puntini = ({ etichetta }: { etichetta: string }) => (
  <p className="animate-pulse px-6 py-4 text-titolo tracking-[0.2em] text-mute" role="status" aria-label={etichetta}>
    ...
  </p>
);

export const TrattativeLista = () => {
  const [parametri, setParametri] = useSearchParams();
  const { percorsi, fasi, inCaricamento, errore } = useFasi();
  const { soci, nomeDi } = useSoci();
  const usati = usePercorsiUsati(percorsi);
  const scelto = parametri.get("percorso");
  const percorso = scelto ?? usati.data?.[0]?.id ?? (usati.isPending ? undefined : percorsi[0]?.id);
  const schede = percorsi.filter((p) => p.id === scelto || usati.data?.some((u) => u.id === p.id));
  const vista = parametri.get("vista") === "elenco" ? "elenco" : "kanban";
  const segue = parametri.get("segue");
  const tag = parametri.get("tag");
  const b = useBacheca(percorso, segue, tag);
  useTagCambiato(tag, "trattativa", b.riprova);
  const sogliaDi = useSoglie();
  const oggi = useGiornoRoma();
  const colonne = useMemo(() => fasi.filter((f) => f.percorso === percorso), [fasi, percorso]);
  const { sposta, inAttesa, dialogo } = useSposta(fasi);
  const ordinaEl = parametri.get("ordina");
  const ordineElenco = useMemo<Ordine | null>(() => {
    const [campo, dir] = (ordinaEl ?? "").split(":");
    return campo ? { campo, dir: dir === "desc" ? "desc" : "asc" } : null;
  }, [ordinaEl]);
  const elenco = useElencoTrattative(percorso, segue, tag, vista === "elenco", ordineElenco);
  const campi = useCampiColonne<RigaElenco>("trattativa");
  const tutteLeColonne = useMemo(
    () => [...colonneTrattative({ fasi: colonne, tutteLeFasi: fasi, percorsi, sposta, nomeDi, sogliaDi, oggi }), ...campi],
    [colonne, fasi, percorsi, sposta, nomeDi, sogliaDi, oggi, campi],
  );
  const statoColonne = useColonne("trattative", tutteLeColonne);
  const [nuovaIn, setNuovaIn] = useState<FaseRiga | null>(null);
  const azioni = useAzioniRiga("trattative");
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const [tutte, setTutte] = useState<{ fase: FaseRiga; righe: Trattativa[] } | null>(null);
  const archiviaTutte = async () => {
    if (!tutte) return;
    const { righe: daArchiviare } = tutte;
    setTutte(null);
    const esiti = await Promise.allSettled(daArchiviare.map((t) => dp.archivia("trattative", { id: t.id })));
    const male = esiti.filter((x) => x.status === "rejected").length;
    notify(male ? `${male} non archiviate: riprova` : `${daArchiviare.length} archiviate: si ritrovano nelle Viste`, { type: male ? "error" : "info" });
    await qc.invalidateQueries({ queryKey: ["trattative"] });
  };

  const imposta = (chiave: string, valore: string | null) =>
    setParametri(
      (p) => {
        if (valore === null) p.delete(chiave);
        else p.set(chiave, valore);
        return p;
      },
      { replace: true },
    );

  const righe = useMemo(
    () => (inAttesa ? b.righe.map((t) => (t.id === inAttesa.t.id ? { ...t, fase_id: inAttesa.fase.id } : t)) : b.righe),
    [b.righe, inAttesa],
  );
  const { aziende, persone } = b;
  const tipi = useMemo(() => new Map(colonne.map((f) => [f.id, f.tipo])), [colonne]);
  const datiDi = useCallback(
    (t: Trattativa): DatiCarta => ({
      t,
      azienda: t.azienda_id ? aziende.get(t.azienda_id)?.nome : undefined,
      persona: t.persona_id ? persone.get(t.persona_id)?.nome : undefined,
      segue: nomeDi(t.segue),
      tipo: tipi.get(t.fase_id) ?? "aperta",
      soglia: sogliaDi(t.fase_id),
      oggi,
    }),
    [aziende, persone, nomeDi, tipi, sogliaDi, oggi],
  );

  const inColonna = righe.filter((t) => tipi.has(t.fase_id));
  const inCorso = inColonna.filter((t) => tipi.get(t.fase_id) === "aperta").reduce((s, t) => s + numero(t.valore), 0);
  const fuori = righe.length - inColonna.length;

  const nuova = () => {
    const prima = colonne.find((f) => f.tipo === "aperta") ?? colonne[0];
    if (prima) setNuovaIn(prima);
  };
  const conteggio = b.inCaricamento
    ? undefined
    : `${inColonna.length} ${inColonna.length === 1 ? "trattativa" : "trattative"}, ${euro(inCorso)} in corso`;

  return (
    <AzioniRiga.Provider value={azioni.apri}>
    <div data-pagina="trattative" className="flex h-full min-h-0 flex-1 flex-col">
      <Testata
        titolo="Trattative"
        conteggio={conteggio}
        azioni={
          <>
            {vista === "elenco" ? <ScegliColonne stato={statoColonne} /> : null}
            <Button onClick={nuova} disabled={!colonne.length}>
              <Plus />
              Nuova trattativa
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 px-6 pb-2.5">
        <Segmenti
          etichetta="Vista"
          valore={vista}
          onScegli={(v) => imposta("vista", v === "elenco" ? "elenco" : null)}
          opzioni={[
            { valore: "elenco", etichetta: (<><Table2 />Elenco</>) },
            { valore: "kanban", etichetta: (<><SquareKanban />Bacheca</>) },
          ]}
        />
        {schede.length > 1 ? (
          <Segmenti
            etichetta="Percorso"
            valore={percorso ?? ""}
            onScegli={(v) => imposta("percorso", v)}
            opzioni={schede.map((p) => ({ valore: p.id, etichetta: p.nome }))}
          />
        ) : null}
        <span className="mx-1 h-[18px] w-px bg-line" />
        {segue ? (
          <PillolaFiltro campo="seguita da" valore={nomeDi(segue)} onTogli={() => imposta("segue", null)} />
        ) : (
          <Scelta
            etichetta="Seguita da"
            valore={null}
            vuoto="Seguita da"
            className="border-transparent text-ink2 hover:bg-hover"
            opzioni={soci.map((s) => ({ valore: s.email, etichetta: s.nome || s.email }))}
            onScegli={(v) => imposta("segue", v)}
          />
        )}
        <SceltaFiltroTag valore={tag} onCambia={(id) => imposta("tag", id)} />
      </div>
      {fuori > 0 ? (
        <p role="status" className="mx-6 mb-2 rounded-md bg-warn-soft px-3 py-1.5 text-warn">
          {fuori === 1 ? "Una trattativa è" : `${fuori} trattative sono`} in una fase di un altro percorso: non si vedono qui.
        </p>
      ) : null}
      {}
      <div data-scorre className="flex min-h-0 flex-1 flex-col overflow-auto">
      {errore || b.errore || (vista === "elenco" && elenco.error) ? (
        <div role="alert" className="mx-6 flex items-center gap-3 rounded-lg border border-line p-4 text-ink2">
          Le trattative non si sono caricate.
          <Button variant="outline" onClick={() => { void b.riprova(); void elenco.refetch(); }}>
            Riprova
          </Button>
        </div>
      ) : inCaricamento || b.inCaricamento || (vista === "elenco" && elenco.isPending) ? (
        <Puntini etichetta="Carico le trattative" />
      ) : vista === "elenco" ? (
        <Elenco
          fasi={colonne}
          righe={(elenco.data ?? []).filter((t) => tipi.has(t.fase_id))}
          stato={statoColonne}
          ordine={ordineElenco}
          onOrdina={(o) => imposta("ordina", `${o.campo}:${o.dir}`)}
          chiaveRighe={JSON.stringify([percorso, segue, tag, ordineElenco])}
        />
      ) : (
        <Bacheca fasi={colonne} righe={righe} datiDi={datiDi} onSposta={sposta} onAggiungi={setNuovaIn} onArchiviaTutte={(fase, r) => setTutte({ fase, righe: r })} />
      )}
      </div>
      {dialogo}
      {nuovaIn ? <NuovaTrattativa fase={nuovaIn} onChiudi={() => setNuovaIn(null)} /> : null}
      {azioni.nodo}
      {tutte ? (
        <Dialog open onOpenChange={(a) => !a && setTutte(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archiviare {tutte.righe.length} trattative?</DialogTitle>
              <DialogDescription>
                Tutte quelle in «{tutte.fase.nome}» escono dalla bacheca. Non si perde niente: si ritrovano nelle Viste.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTutte(null)}>
                Annulla
              </Button>
              <Button onClick={() => void archiviaTutte()}>Archivia</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
    </AzioniRiga.Provider>
  );
};
