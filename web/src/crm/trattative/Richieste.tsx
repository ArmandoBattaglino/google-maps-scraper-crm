import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataOra } from "@/crm/DataOra";
import { cn } from "@/lib/utils";
import { giornoRoma } from "@/crm/tempo";
import { MOTIVI_PERSO, type FaseRiga, type Trattativa } from "./tipi";

interface Comune {
  t: Trattativa;
  fase: FaseRiga;
  onAnnulla: () => void;
}

export const RichiestaPasso = ({
  t,
  fase,
  onAnnulla,
  onConferma,
}: Comune & { onConferma: (d: { prossimo_passo: string; prossimo_il: string }) => void }) => {
  const oggi = giornoRoma();
  const [passo, setPasso] = useState(t.prossimo_passo ?? "");
  const [quando, setQuando] = useState(t.prossimo_il && giornoRoma(t.prossimo_il) >= oggi ? t.prossimo_il : null);
  const [provato, setProvato] = useState(false);
  const passoOk = passo.trim().length > 0;
  const giornoOk = !!quando && giornoRoma(quando) >= oggi;

  const invia = (e: FormEvent) => {
    e.preventDefault();
    setProvato(true);
    if (!passoOk || !quando || !giornoOk) return;
    onConferma({ prossimo_passo: passo.trim(), prossimo_il: quando });
  };

  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onAnnulla()}>
      <DialogContent data-richiesta="passo">
        <form onSubmit={invia} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Sposta in {fase.nome}</DialogTitle>
            <DialogDescription>Una trattativa aperta ha sempre un prossimo passo con la sua data.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="prossimo-passo">Prossimo passo</Label>
            <Input
              id="prossimo-passo"
              autoFocus
              maxLength={300}
              value={passo}
              aria-invalid={provato && !passoOk}
              onChange={(e) => setPasso(e.target.value)}
            />
            {provato && !passoOk ? <p className="text-xs text-danger">Scrivi cosa farai dopo.</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="prossimo-il">Data</Label>
            <DataOra id="prossimo-il" etichetta="Data" min={oggi} svuotabile={false} className="w-[190px]" valore={quando} invalido={provato && !giornoOk} onCambia={setQuando} />
            {provato && !giornoOk ? <p className="text-xs text-danger">Scegli oggi o un giorno che deve ancora venire.</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onAnnulla}>
              Annulla
            </Button>
            <Button type="submit">Salva e sposta</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const RichiestaMotivo = ({
  t,
  fase,
  onAnnulla,
  onConferma,
}: Comune & { onConferma: (d: { motivo_perso: string | null }) => void }) => {
  const [motivo, setMotivo] = useState<string | null>(t.motivo_perso);
  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onAnnulla()}>
      <DialogContent data-richiesta="motivo">
        <DialogHeader>
          <DialogTitle>Sposta in {fase.nome}</DialogTitle>
          <DialogDescription>Perché è andata così?</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Motivo">
          {MOTIVI_PERSO.map((m) => (
            <button
              key={m.valore}
              type="button"
              aria-pressed={motivo === m.valore}
              onClick={() => setMotivo(motivo === m.valore ? null : m.valore)}
              className={cn(
                "h-[26px] rounded-full border border-line px-2.5 text-ink2 hover:bg-hover",
                motivo === m.valore && "border-transparent bg-acc-soft text-acc-ink hover:bg-acc-soft-hover",
              )}
            >
              {m.etichetta}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onAnnulla}>
            Annulla
          </Button>
          <Button type="button" onClick={() => onConferma({ motivo_perso: motivo })}>
            Salva e sposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
