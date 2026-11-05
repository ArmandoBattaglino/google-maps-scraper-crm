import { useRef, useState, type MouseEvent } from "react";
import { useNotify } from "ra-core";
import { Button, buttonVariants } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRegistra } from "@/crm/attivita/dati";
import { Puntini } from "@/crm/persone/link";
import { cn } from "@/lib/utils";
import { useModelli, useSalvaModello, useSocio, type Destinatario } from "./dati";
import { linkWa, riempi, type Segnaposto } from "./testo";

const LIBERO = "libero";

const MANCA: Record<Segnaposto, string> = {
  nome: "Manca il nome della persona: aggiungilo alla scheda o togli {nome} dal testo.",
  azienda: "Manca l'azienda: legala alla scheda o togli {azienda} dal testo.",
  utente: "Manca il tuo nome: togli {utente} dal testo.",
};

export const ContenutoDialogo = ({ d, onChiudi }: { d: Destinatario; onChiudi: () => void }) => {
  const { data: modelli, isPending, error } = useModelli();
  const socio = useSocio();
  const { registra } = useRegistra();
  const { salva, salvando } = useSalvaModello();
  const notify = useNotify();
  const [scelta, setScelta] = useState<string | null>(null);
  const [scritto, setScritto] = useState<string | null>(null);
  const [nomeModello, setNomeModello] = useState<string | null>(null);
  const inCorso = useRef(false);

  const lista = modelli ?? [];
  const id = scelta ?? lista[0]?.id ?? LIBERO;
  const modello = lista.find((m) => m.id === id);
  const bozza = scritto ?? modello?.testo ?? "";
  const { testo, mancanti } = riempi(bozza, { nome: d.nome, azienda: d.azienda, utente: socio });
  const voci = [...lista.map((m) => ({ value: m.id, label: m.nome })), { value: LIBERO, label: "Testo libero" }];

  const scegli = (valore: string | null) => {
    setScelta(valore);
    setScritto(valore === LIBERO ? "" : null);
  };
  const apri = (e: MouseEvent) => {
    if (inCorso.current) {
      e.preventDefault();
      return;
    }
    inCorso.current = true;
    void registra({ ...d.legami, tipo: "whatsapp", esito: "inviato", testo }).then((ok) => {
      inCorso.current = false;
      if (!ok) return;
      notify("WhatsApp registrato nella cronologia.", { type: "success" });
      onChiudi();
    });
  };
  const salvaModello = async () => {
    const nome = nomeModello?.trim();
    if (!nome) return;
    const nuovo = await salva(nome, bozza);
    if (nuovo === null) return;
    setScelta(nuovo);
    setScritto(null);
    setNomeModello(null);
  };

  return (
    <>
      <DialogHeader className="gap-1">
        <DialogTitle className="text-base font-semibold text-ink">WhatsApp a {d.nome || d.azienda}</DialogTitle>
        <DialogDescription className="text-ink2 tabular-nums">+{d.numero}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        {isPending ? <Puntini etichetta="Carico i modelli" /> : null}
        {error ? <p className="m-0 text-danger">Non riesco a leggere i modelli: scrivi il testo qui sotto.</p> : null}
        {!isPending && !error && !lista.length ? (
          <p className="m-0 text-mute">Nessun modello ancora: scrivi il testo e salvalo per la prossima volta.</p>
        ) : null}
        {lista.length ? (
          <div className="grid gap-1 text-ink2">
            <span aria-hidden="true">Modello</span>
            <Select items={voci} value={id} onValueChange={scegli}>
              <SelectTrigger aria-label="Modello" className="w-full text-ink">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voci.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <label className="grid gap-1 text-ink2">
          Testo
          <Textarea value={bozza} onChange={(e) => setScritto(e.target.value)} rows={5} className="max-h-52 resize-y text-ink" />
          <span className="text-xs text-mute">{"{nome}, {azienda} e {utente} si riempiono da soli."}</span>
        </label>
        {testo !== bozza ? (
          <div className="grid gap-1 text-ink2">
            Il messaggio che parte
            <p data-anteprima className="m-0 max-h-52 overflow-y-auto rounded-lg bg-side px-3 py-2.5 break-words whitespace-pre-wrap text-ink">
              {testo}
            </p>
          </div>
        ) : null}
        {mancanti.map((m) => (
          <p key={m} data-manca={m} className="m-0 rounded-lg bg-warn-soft px-3 py-2 text-warn">
            {MANCA[m]}
          </p>
        ))}
        {nomeModello !== null ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void salvaModello();
            }}
          >
            <Input
              autoFocus
              aria-label="Nome del modello"
              placeholder="Nome del modello"
              maxLength={80}
              value={nomeModello}
              onChange={(e) => setNomeModello(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={salvando || !nomeModello.trim()}>
              Salva modello
            </Button>
          </form>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {nomeModello === null ? (
          <Button variant="ghost" disabled={!bozza.trim() || bozza === modello?.testo} onClick={() => setNomeModello("")}>
            Salva come modello
          </Button>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onChiudi}>
            Annulla
          </Button>
          {mancanti.length || isPending ? (
            <Button disabled>Apri WhatsApp</Button>
          ) : (
            <a
              href={linkWa(d.numero, testo)}
              target="_blank"
              rel="noopener noreferrer"
              data-whatsapp
              onClick={apri}
              onAuxClick={(e) => {
                if (e.button === 1) apri(e);
              }}
              className={cn(buttonVariants())}
            >
              Apri WhatsApp
            </a>
          )}
        </div>
      </div>
    </>
  );
};
