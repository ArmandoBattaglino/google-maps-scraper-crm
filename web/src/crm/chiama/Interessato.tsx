import { useState, type FormEvent } from "react";
import { useGetIdentity } from "ra-core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataOra } from "@/crm/DataOra";
import { Scelta } from "@/crm/Scelta";
import { useSoci } from "@/crm/soci";
import { giornoRoma } from "@/crm/tempo";

export interface DatiInteressato {
  persona: string;
  prossimo_il: string;
  segue?: string;
  nota?: string;
}

const messaggio = (e: unknown) => (e instanceof Error && e.message ? e.message : "Il server non risponde.");

export const FinestraInteressato = ({
  azienda,
  referente,
  notaIniziale = "",
  onConferma,
  onAnnulla,
}: {
  azienda: string;
  referente?: string;
  notaIniziale?: string;
  onConferma: (d: DatiInteressato) => Promise<unknown>;
  onAnnulla: () => void;
}) => {
  const { identity } = useGetIdentity();
  const { soci } = useSoci();
  const [persona, setPersona] = useState(referente ?? "");
  const [quando, setQuando] = useState<string | null>(null);
  const [scelto, setScelto] = useState<string | null>(null);
  const [nota, setNota] = useState(notaIniziale);
  const [provato, setProvato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const io = identity?.id ? String(identity.id).toLowerCase() : null;
  const segue = scelto ?? io;
  const oggi = giornoRoma();
  const nomeOk = persona.trim().length > 0;
  const giornoOk = !!quando && giornoRoma(quando) >= oggi;

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    setProvato(true);
    if (!nomeOk || !giornoOk || !quando || salvo) return;
    setSalvo(true);
    setErrore(null);
    try {
      await onConferma({ persona: persona.trim(), prossimo_il: quando, ...(segue ? { segue } : {}), ...(nota.trim() ? { nota: nota.trim() } : {}) });
    } catch (err) {
      setSalvo(false);
      setErrore(messaggio(err));
    }
  };

  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onAnnulla()}>
      <DialogContent data-finestra-interessato data-richiesta="apri-trattativa" data-azienda-interessata={azienda}>
        <form onSubmit={(e) => void invia(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Interessata: apri la trattativa</DialogTitle>
            <DialogDescription>Entra nella prima colonna della bacheca. Finché non confermi non è scritto niente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="interessato-persona">Con chi hai parlato</Label>
            <Input id="interessato-persona" name="persona" autoFocus maxLength={200} value={persona} aria-invalid={provato && !nomeOk} onChange={(e) => setPersona(e.target.value)} />
            {provato && !nomeOk ? <p className="text-xs text-danger">Scrivi il nome di chi ha parlato.</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="interessato-data">Prossimo passo</Label>
            <DataOra id="interessato-data" etichetta="Data e ora del prossimo passo" min={oggi} svuotabile={false} className="w-[220px]" valore={quando} invalido={provato && !giornoOk} onCambia={setQuando} />
            {provato && !giornoOk ? <p className="text-xs text-danger">Scegli oggi o un giorno che deve ancora venire.</p> : null}
          </div>
          <div className="grid gap-1.5" data-segue>
            <Label>Segue</Label>
            <Scelta etichetta="Segue" valore={segue} className="w-full" opzioni={soci.map((s) => ({ valore: s.email.toLowerCase(), etichetta: s.nome || s.email }))} onScegli={setScelto} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="interessato-nota">Nota</Label>
            <Textarea id="interessato-nota" name="nota" rows={3} maxLength={10_000} value={nota} placeholder="Facoltativa, entra in cronologia" onChange={(e) => setNota(e.target.value)} />
          </div>
          {errore ? (
            <p role="alert" className="text-xs text-danger">
              {errore}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onAnnulla}>
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
