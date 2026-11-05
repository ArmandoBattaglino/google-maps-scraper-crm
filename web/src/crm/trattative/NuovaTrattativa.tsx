import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, useGetList, useNotify } from "ra-core";
import { LogoAzienda } from "@/components/crm/forme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Azienda, Persona } from "@/crm/nomi";
import type { DatiCrm } from "@/providers/dati";
import { DataOra } from "@/crm/DataOra";
import { Scelta } from "@/crm/Scelta";
import { giornoRoma } from "@/crm/tempo";
import { useArriviAzienda } from "@/crm/origini/DaDoveScheda";
import { NESSUNA, SceltaCanale, canaleOk, type ValoreCanale } from "@/crm/origini/SceltaCanale";
import type { FaseRiga } from "./tipi";

const PER_NOME = { field: "nome", order: "ASC" as const };

const CercaAzienda = ({ scelta, onScegli }: { scelta: Azienda | null; onScegli: (a: Azienda | null) => void }) => {
  const [testo, setTesto] = useState("");
  const [cerca, setCerca] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setCerca(testo.trim()), 200);
    return () => clearTimeout(t);
  }, [testo]);
  const { data } = useGetList<Azienda>(
    "aziende",
    { pagination: { page: 1, perPage: 6 }, sort: PER_NOME, filter: { q: cerca } },
    { enabled: cerca.length > 0 && !scelta },
  );
  if (scelta) {
    return (
      <div className="flex h-[30px] items-center gap-2 rounded-md border border-line px-2">
        <LogoAzienda nome={scelta.nome} />
        <span className="min-w-0 truncate text-ink">{scelta.nome}</span>
        <button type="button" onClick={() => onScegli(null)} className="ml-auto text-xs text-mute hover:text-ink">
          Cambia
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <Input
        id="nuova-azienda"
        autoFocus
        autoComplete="off"
        placeholder="Cerca per nome"
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
      />
      {cerca && data ? (
        <ul className="rounded-md border border-line p-1" aria-label="Aziende trovate">
          {data.length === 0 ? <li className="px-2 py-1.5 text-mute">Nessuna azienda con questo nome.</li> : null}
          {data.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onScegli(a)}
                className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-ink hover:bg-hover"
              >
                <LogoAzienda nome={a.nome} />
                <span className="min-w-0 truncate">{a.nome}</span>
                {a.comune ? <small className="ml-auto text-xs whitespace-nowrap text-mute">{a.comune}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export const NuovaTrattativa = ({ fase, onChiudi }: { fase: FaseRiga; onChiudi: () => void }) => {
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const [azienda, setAzienda] = useState<Azienda | null>(null);
  const [persona, setPersona] = useState<string | null>(null);
  const [avvio, setAvvio] = useState("");
  const [canone, setCanone] = useState("");
  const [passo, setPasso] = useState("");
  const [quando, setQuando] = useState<string | null>(null);
  const [provato, setProvato] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [canale, setCanale] = useState<ValoreCanale>({ voce: NESSUNA, da_chi: "" });
  const { data: arrivi } = useArriviAzienda(azienda?.id);
  const senzaOrigine = !!azienda && arrivi !== undefined && arrivi.length === 0;
  const voceScelta = senzaOrigine && canale.voce === NESSUNA ? "mano" : canale.voce;
  const { data: persone } = useGetList<Persona>(
    "persone",
    { pagination: { page: 1, perPage: 50 }, sort: PER_NOME, filter: { azienda_id: azienda?.id } },
    { enabled: !!azienda },
  );
  const oggi = giornoRoma();
  const aperta = fase.tipo === "aperta";
  const dataOk = !!quando && giornoRoma(quando) >= oggi;
  const ok = !!azienda && (!aperta || (passo.trim().length > 0 && dataOk)) && canaleOk(canale);

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    setProvato(true);
    if (!ok || !azienda) return;
    setSalvo(true);
    try {
      const nuova = await dp.create("trattative", {
        data: {
          azienda_id: azienda.id,
          persona_id: persona,
          percorso: fase.percorso,
          fase_id: fase.id,
          avvio: avvio === "" ? null : Number(avvio),
          canone: canone === "" ? null : Number(canone),
          prossimo_passo: passo.trim(),
          prossimo_il: quando,
          segue: identity?.id ?? null,
        },
      });
      if (voceScelta !== NESSUNA) {
        await dp.posta("origini", { azienda_id: azienda.id, voce: voceScelta, da_chi: canale.da_chi.trim(), persona_id: persona, trattativa_id: nuova.data.id });
        void qc.invalidateQueries({ queryKey: ["origini"] });
      }
      void qc.invalidateQueries({ queryKey: ["trattative"] });
      onChiudi();
    } catch (err) {
      setSalvo(false);
      notify(`La trattativa non è stata creata: ${err instanceof Error ? err.message : "errore del servizio"}`, { type: "error" });
    }
  };

  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onChiudi()}>
      <DialogContent data-richiesta="nuova">
        <form onSubmit={(e) => void invia(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Nuova trattativa in {fase.nome}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="nuova-azienda">Azienda</Label>
            <CercaAzienda
              scelta={azienda}
              onScegli={(a) => {
                setAzienda(a);
                setPersona(null);
              }}
            />
            {provato && !azienda ? <p className="text-xs text-danger">Scegli un'azienda.</p> : null}
          </div>
          {persone && persone.length > 0 ? (
            <div className="grid gap-1.5">
              <Label>Persona</Label>
              <Scelta
                etichetta="Persona"
                valore={persona}
                vuoto="Nessuna"
                className="w-full"
                opzioni={persone.map((p) => ({ valore: p.id, etichetta: p.nome }))}
                onScegli={setPersona}
              />
            </div>
          ) : null}
          {azienda ? (
            <SceltaCanale
              valore={{ voce: voceScelta, da_chi: canale.da_chi }}
              conNessuna={!senzaOrigine}
              provato={provato}
              onCambia={setCanale}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nuova-avvio">Avvio, in euro</Label>
              <Input id="nuova-avvio" type="number" min={0} step="0.01" value={avvio} onChange={(e) => setAvvio(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nuova-canone">Canone al mese, in euro</Label>
              <Input id="nuova-canone" type="number" min={0} step="0.01" value={canone} onChange={(e) => setCanone(e.target.value)} />
            </div>
          </div>
          {aperta ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="nuova-passo">Prossimo passo</Label>
                <Input id="nuova-passo" maxLength={300} value={passo} onChange={(e) => setPasso(e.target.value)} />
                {provato && !passo.trim() ? <p className="text-xs text-danger">Scrivi cosa farai dopo.</p> : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nuova-data">Data</Label>
                <DataOra id="nuova-data" etichetta="Data" min={oggi} svuotabile={false} className="w-[190px]" valore={quando} invalido={provato && !dataOk} onCambia={setQuando} />
                {provato && !dataOk ? <p className="text-xs text-danger">Scegli oggi o un giorno che deve ancora venire.</p> : null}
              </div>
            </>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onChiudi}>
              Annulla
            </Button>
            <Button type="submit" disabled={salvo}>
              Crea la trattativa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
