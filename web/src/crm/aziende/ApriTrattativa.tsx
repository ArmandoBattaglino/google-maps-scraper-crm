import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetList, useNotify } from "ra-core";
import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apriDaInteressato } from "@/crm/chiama/api";
import { FinestraInteressato } from "@/crm/chiama/Interessato";
import { DataOra } from "@/crm/DataOra";
import { Scelta } from "@/crm/Scelta";
import { TUTTE } from "@/crm/scheda/dati";
import { giornoRoma } from "@/crm/tempo";
import type { DatiCrm } from "@/providers/dati";

const Dialogo = ({ azienda, onChiudi }: { azienda: string; onChiudi: () => void }) => {
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const navigate = useNavigate();
  const { data: percorsi } = useGetList<{ id: string; nome: string }>("percorsi", { pagination: TUTTE, sort: { field: "ordine", order: "ASC" } });
  const [scelto, setScelto] = useState<string | null>(null);
  const [passo, setPasso] = useState("");
  const [quando, setQuando] = useState<string | null>(null);
  const [provato, setProvato] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const percorso = scelto ?? percorsi?.find((p) => p.id === "freddo")?.id ?? percorsi?.[0]?.id ?? null;
  const oggi = giornoRoma();
  const passoOk = passo.trim().length > 0;
  const giornoOk = !!quando && giornoRoma(quando) >= oggi;

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    setProvato(true);
    if (!percorso || !passoOk || !giornoOk) return;
    setSalvo(true);
    try {
      const t = await dp.posta<{ id: string }>("trattative/da-azienda", { azienda_id: azienda, percorso });
      await dp.patch("trattative", { id: t.id, data: { prossimo_passo: passo.trim(), prossimo_il: quando } });
      for (const risorsa of ["trattative", "aziende", "persone"]) void qc.invalidateQueries({ queryKey: [risorsa] });
      navigate(`/trattative/${t.id}`);
    } catch (err) {
      setSalvo(false);
      notify(`La trattativa non è stata aperta: ${err instanceof Error ? err.message : "errore del servizio"}`, { type: "error" });
    }
  };

  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onChiudi()}>
      <DialogContent data-richiesta="apri-trattativa">
        <form onSubmit={(e) => void invia(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Apri una trattativa</DialogTitle>
            <DialogDescription>Entra nella prima colonna della bacheca.</DialogDescription>
          </DialogHeader>
          {percorsi && percorsi.length > 1 ? (
            <div className="grid gap-1.5">
              <Label>Percorso</Label>
              <Scelta
                etichetta="Percorso"
                valore={percorso}
                className="w-full"
                opzioni={percorsi.map((p) => ({ valore: p.id, etichetta: p.nome }))}
                onScegli={setScelto}
              />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="apri-passo">Prossimo passo</Label>
            <Input id="apri-passo" autoFocus maxLength={300} value={passo} aria-invalid={provato && !passoOk} onChange={(e) => setPasso(e.target.value)} />
            {provato && !passoOk ? <p className="text-xs text-danger">Scrivi cosa farai dopo.</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="apri-data">Data</Label>
            <DataOra id="apri-data" etichetta="Data" min={oggi} svuotabile={false} className="w-[190px]" valore={quando} invalido={provato && !giornoOk} onCambia={setQuando} />
            {provato && !giornoOk ? <p className="text-xs text-danger">Scegli oggi o un giorno che deve ancora venire.</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onChiudi}>
              Annulla
            </Button>
            <Button type="submit" disabled={salvo}>
              Apri la trattativa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const ApriTrattativa = ({ azienda, esito, contatto, aperte, referente }: { azienda: string; esito?: string; contatto?: string | null; aperte: number; referente?: string }) => {
  const [aperto, setAperto] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  if (aperte > 0) return null;
  if (!contatto && esito !== "interessato") {
    return <p className="px-2 py-1 text-xs text-mute">Dopo una chiamata con «Interessato» da qui si apre la trattativa.</p>;
  }
  return (
    <>
      <Button variant="ghost" size="sm" className="mt-0.5 text-mute" onClick={() => setAperto(true)}>
        <Plus />
        Apri trattativa
      </Button>
      {!aperto ? null : !contatto ? (
        <FinestraInteressato
          azienda={azienda}
          referente={referente}
          onAnnulla={() => setAperto(false)}
          onConferma={async (d) => {
            const t = await apriDaInteressato({ azienda_id: azienda, ...d });
            for (const risorsa of ["trattative", "aziende", "persone"]) void qc.invalidateQueries({ queryKey: [risorsa] });
            navigate(`/trattative/${t.id}`);
          }}
        />
      ) : (
        <Dialogo azienda={azienda} onChiudi={() => setAperto(false)} />
      )}
    </>
  );
};
