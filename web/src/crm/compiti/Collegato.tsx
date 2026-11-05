import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRegistra } from "@/crm/attivita/dati";
import { domani, romaAIso } from "@/crm/attivita/tempo";
import { DataOra } from "@/crm/DataOra";
import { ICONA_ENTITA } from "@/crm/entita";
import { useSoci } from "@/crm/soci";
import { useIo } from "@/hooks/useIo";
import { useCollegabili, useModificaCompito, type Collegabile, type Legame, type RigaCompito } from "./dati";
import { ScegliSocio } from "./ScegliSocio";

const TIPI: { tipo: Legame; nome: string; entita: keyof typeof ICONA_ENTITA }[] = [
  { tipo: "trattativa", nome: "Trattative", entita: "trattative" },
  { tipo: "persona", nome: "Persone", entita: "persone" },
  { tipo: "azienda", nome: "Aziende", entita: "aziende" },
];
const ICONA: Record<Legame, keyof typeof ICONA_ENTITA> = { trattativa: "trattative", persona: "persone", azienda: "aziende" };
const NOME: Record<Legame, string> = { trattativa: "Trattativa", persona: "Persona", azienda: "Azienda" };

const FINE_GIORNO = "23:59";

const ScegliCollegato = ({ scelto, onScegli, fuoco }: { scelto: Collegabile | null; onScegli: (c: Collegabile | null) => void; fuoco?: boolean }) => {
  const [testo, setTesto] = useState("");
  const [cerca, setCerca] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setCerca(testo.trim()), 200);
    return () => clearTimeout(t);
  }, [testo]);
  const { data, isFetching } = useCollegabili(scelto ? "" : cerca);
  if (scelto) {
    const Icona = ICONA_ENTITA[ICONA[scelto.tipo]];
    return (
      <div data-collegato-scelto={scelto.tipo} className="flex min-h-[38px] items-center gap-2 rounded-md border border-line px-2 py-1">
        <Icona className="size-3.5 shrink-0 text-mute-deco" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-ink">{scelto.nome}</span>
          <span className="block truncate text-xs text-mute">{[NOME[scelto.tipo], scelto.dettaglio].filter(Boolean).join(" · ")}</span>
        </span>
        <button
          type="button"
          aria-label="Cambia il collegamento"
          onClick={() => onScegli(null)}
          className="ml-auto grid size-6 shrink-0 place-items-center rounded-md text-mute hover:bg-hover hover:text-ink [&_svg]:size-3.5"
        >
          <X />
        </button>
      </div>
    );
  }
  const righe = cerca && data ? data.righe : [];
  return (
    <div className="grid gap-1">
      <Input
        id="collegato-a"
        autoFocus={fuoco}
        autoComplete="off"
        placeholder="Cerca un'azienda, una persona, una trattativa"
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
      />
      {cerca && data ? (
        <div data-collegabili aria-busy={isFetching} className="max-h-[260px] overflow-y-auto rounded-md border border-line p-1">
          {righe.length === 0 ? <p className="px-2 py-1.5 text-mute">Niente con questo nome.</p> : null}
          {TIPI.map(({ tipo, nome, entita }) => {
            const diQuesto = righe.filter((r) => r.tipo === tipo);
            if (!diQuesto.length) return null;
            const Icona = ICONA_ENTITA[entita];
            return (
              <div key={tipo} data-collegabili-tipo={tipo}>
                <p className="flex items-center gap-1.5 px-2 pt-1.5 pb-0.5 text-xs font-medium text-mute [&_svg]:size-3 [&_svg]:text-mute-deco">
                  <Icona aria-hidden="true" />
                  {nome}
                </p>
                <ul>
                  {diQuesto.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        data-collegabile={r.id}
                        onClick={() => onScegli(r)}
                        className="block w-full rounded-[6px] px-2 py-1 text-left outline-none hover:bg-hover focus-visible:bg-hover"
                      >
                        <span className="block truncate text-ink">{r.nome}</span>
                        {r.dettaglio ? <span className="block truncate text-xs text-mute">{r.dettaglio}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const SPIEGA = "Una trattativa porta con sé la sua azienda e la sua persona, una persona la sua azienda.";

export const NuovoCompito = ({ onChiudi }: { onChiudi: () => void }) => {
  const { registra, salvando } = useRegistra();
  const [testo, setTesto] = useState("");
  const [collegato, setCollegato] = useState<Collegabile | null>(null);
  const [scadenza, setScadenza] = useState<string | null>(() => romaAIso(`${domani()}T23:59:59`));
  const [provato, setProvato] = useState(false);
  const { soci, nomeDi } = useSoci();
  const io = useIo().data?.email.toLowerCase() ?? null;
  const [scelto, setScelto] = useState<string | null>(null);
  const assegnato = scelto ?? io;
  const ok = testo.trim().length > 0 && Boolean(collegato);

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    setProvato(true);
    if (!ok || !collegato) return;
    const fatto = await registra({
      tipo: "compito",
      testo: testo.trim(),
      scadenza,
      assegnato_a: assegnato,
      azienda_id: collegato.azienda_id,
      persona_id: collegato.persona_id,
      trattativa_id: collegato.trattativa_id,
    });
    if (fatto) onChiudi();
  };

  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onChiudi()}>
      <DialogContent data-nuovo-compito>
        <form onSubmit={(e) => void invia(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Nuovo compito</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="compito-testo">Cosa c'è da fare</Label>
            <Textarea id="compito-testo" autoFocus rows={2} maxLength={2000} value={testo} onChange={(e) => setTesto(e.target.value)} />
            {provato && !testo.trim() ? <p className="text-xs text-danger">Scrivi cosa c'è da fare.</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="collegato-a">Collegato a</Label>
            <ScegliCollegato scelto={collegato} onScegli={setCollegato} />
            {provato && !collegato ? <p className="text-xs text-danger">Un compito sta su un'azienda, una persona o una trattativa: scegline una.</p> : <p className="text-xs text-mute">{SPIEGA}</p>}
          </div>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="compito-scadenza">Scadenza</Label>
              <DataOra id="compito-scadenza" etichetta="Scadenza" oraVuota={FINE_GIORNO} valore={scadenza} onCambia={setScadenza} className="w-[220px]" />
            </div>
            <div data-nuovo-assegnato className="grid gap-1.5">
              <Label>Assegnato a</Label>
              <div className="flex h-[30px] items-center">
                <ScegliSocio valore={assegnato} nome={nomeDi(assegnato)} soci={soci} etichetta="Assegnato a" onScegli={setScelto} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onChiudi}>
              Annulla
            </Button>
            <Button type="submit" disabled={salvando}>
              Crea compito
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const collegatoAdesso = (r: RigaCompito) => {
  if (r.legame === "trattativa") return `Trattativa di ${r.azienda_nome ?? r.persona_nome ?? "nessuno"}${r.fase_nome ? `, in ${r.fase_nome}` : ""}`;
  if (r.legame === "persona") return `Persona: ${r.persona_nome ?? ""}${r.azienda_nome ? `, ${r.azienda_nome}` : ""}`;
  return `Solo azienda: ${r.azienda_nome ?? ""}`;
};

export const SpostaCollegamento = ({ compito, onChiudi }: { compito: RigaCompito; onChiudi: () => void }) => {
  const modifica = useModificaCompito();
  const [collegato, setCollegato] = useState<Collegabile | null>(null);
  const [salvo, setSalvo] = useState(false);

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    if (!collegato) return;
    setSalvo(true);
    const fatto = await modifica(compito.id, {
      azienda_id: collegato.azienda_id,
      persona_id: collegato.persona_id,
      trattativa_id: collegato.trattativa_id,
    });
    setSalvo(false);
    if (fatto) onChiudi();
  };

  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onChiudi()}>
      <DialogContent data-sposta-compito>
        <form onSubmit={(e) => void invia(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Sposta il collegamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1">
            <p className="truncate text-ink">{compito.testo || "Compito senza testo"}</p>
            <p data-collegato-adesso className="text-xs text-mute">
              Adesso: {collegatoAdesso(compito)}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="collegato-a">Collegato a</Label>
            <ScegliCollegato scelto={collegato} onScegli={setCollegato} fuoco />
            <p className="text-xs text-mute">{SPIEGA}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onChiudi}>
              Annulla
            </Button>
            <Button type="submit" disabled={!collegato || salvo}>
              Sposta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
