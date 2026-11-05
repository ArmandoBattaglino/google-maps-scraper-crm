import { TitoloScheda } from "@/crm/scheda/Campo";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Building2, Users } from "lucide-react";
import { LinkBase, useDataProvider, useGetOne, useNotify } from "ra-core";
import { useParams } from "react-router";
import { AvatarPersona, LogoAzienda } from "@/components/crm/forme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Timeline } from "@/crm/attivita";
import { useAziende, usePersone } from "@/crm/nomi";
import { useChiudiScheda } from "@/crm/pannello/Instradamento";
import { Scelta } from "@/crm/Scelta";
import { useSoci } from "@/crm/soci";
import { PercorsoScheda } from "@/crm/scheda/Scheda";
import { SezioneTag } from "@/crm/tag";
import { DataOra } from "@/crm/DataOra";
import { dataCorta } from "@/crm/tempo";
import type { DatiCrm } from "@/providers/dati";
import { Fermo, giorniFerma, useGiornoRoma, useSoglie } from "./Fermo";
import { MOTIVI_PERSO, TEMPERATURE, euro, titoloTrattativa, type Trattativa } from "./tipi";
import { BottoneWhatsapp } from "@/crm/whatsapp";
import { DaDoveScheda, notaCoperta, useArriviAzienda } from "@/crm/origini/DaDoveScheda";
import { useFasi } from "./useBacheca";
import { useSposta } from "./useSposta";

const Campo = ({ etichetta, children }: { etichetta: string; children: ReactNode }) => (
  <div className="grid min-h-8 grid-cols-[150px_1fr] items-center gap-2">
    <dt className="text-mute">{etichetta}</dt>
    <dd className="min-w-0">{children}</dd>
  </div>
);

const SENZA_BORDO = "border-transparent bg-transparent hover:bg-hover";

const Testo = ({
  valore,
  etichetta,
  tipo = "text",
  vuoto,
  obbligatorio,
  onSalva,
}: {
  valore: string;
  etichetta: string;
  tipo?: string;
  vuoto?: string;
  obbligatorio?: boolean;
  onSalva: (v: string) => void;
}) => {
  const [v, setV] = useState(valore);
  return (
    <Input
      aria-label={etichetta}
      type={tipo}
      min={tipo === "number" ? 0 : undefined}
      step={tipo === "number" ? "0.01" : undefined}
      placeholder={vuoto}
      value={v}
      className={SENZA_BORDO}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (obbligatorio && !v.trim()) setV(valore);
        else if (v !== valore) onSalva(v);
      }}
    />
  );
};

const Legato = ({ a, segno, titolo, sotto }: { a: string; segno: ReactNode; titolo: string; sotto?: string | null }) => (
  <LinkBase to={a} className="flex items-center gap-2.5 rounded-md px-2 py-[7px] text-ink hover:bg-hover">
    {segno}
    <span className="min-w-0">
      <span className="block truncate">{titolo}</span>
      {sotto ? <small className="block truncate text-xs text-mute">{sotto}</small> : null}
    </span>
  </LinkBase>
);

export const TrattativaScheda = () => {
  const { id = "" } = useParams();
  const finito = useChiudiScheda();
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const { data: t, isPending, error, refetch } = useGetOne<Trattativa>("trattative", { id });
  const { fasi } = useFasi();
  const { soci, nomeDi } = useSoci();
  const aziende = useAziende([t?.azienda_id]);
  const persone = usePersone([t?.persona_id]);
  const colonne = fasi.filter((f) => f.percorso === t?.percorso);
  const { sposta, dialogo } = useSposta(colonne);
  const [archivio, setArchivio] = useState(false);
  const sogliaDi = useSoglie();
  const oggi = useGiornoRoma();

  const salva = async (dati: Record<string, unknown>) => {
    try {
      await dp.patch("trattative", { id, data: dati });
    } catch (e) {
      notify(`Non salvato: ${e instanceof Error ? e.message : "errore del servizio"}`, { type: "error" });
    } finally {
      void qc.invalidateQueries({ queryKey: ["trattative"] });
    }
  };
  const archivia = async () => {
    try {
      await dp.archivia("trattative", { id });
      void qc.invalidateQueries({ queryKey: ["trattative"] });
      finito("/trattative");
    } catch (e) {
      notify(`Non archiviata: ${e instanceof Error ? e.message : "errore del servizio"}`, { type: "error" });
    }
  };

  if (isPending) {
    return (
      <p className="animate-pulse px-8 py-6 text-titolo tracking-[0.2em] text-mute" role="status" aria-label="Carico la trattativa">
        ...
      </p>
    );
  }
  if (error || !t) {
    return (
      <div role="alert" className="m-6 flex items-center gap-3 rounded-lg border border-line p-4 text-ink2">
        Questa trattativa non si è caricata.
        <Button variant="outline" onClick={() => void refetch()}>
          Riprova
        </Button>
      </div>
    );
  }

  const azienda = t.azienda_id ? aziende.get(t.azienda_id) : undefined;
  const persona = t.persona_id ? persone.get(t.persona_id) : undefined;
  const fase = colonne.find((f) => f.id === t.fase_id);
  const titolo = titoloTrattativa(azienda?.nome, persona?.nome);
  const ferma = giorniFerma(t, fase?.tipo, sogliaDi(t.fase_id), oggi);
  const numeroDi = (v: string) => (v === "" ? null : Number(v));

  return (
    <div data-pagina="trattativa" className="grid min-h-full grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]">
      <PercorsoScheda lista="Trattative" listaUrl="/trattative" nome={titolo} />
      <div className="min-w-0 border-line px-8 pt-6 pb-12 md:border-r">
        <div className="flex items-start gap-3.5">
          <LogoAzienda nome={titolo} grande />
          <div className="min-w-0">
            {}
            {azienda || persona ? (
              <TitoloScheda
                nome="titolo"
                etichetta={azienda ? "Nome dell'azienda" : "Nome della persona"}
                valore={titolo}
                onSalva={async (v) => {
                  await dp.patch(azienda ? "aziende" : "persone", { id: String((azienda ?? persona)?.id), data: { nome: v } });
                  await qc.invalidateQueries({ queryKey: [azienda ? "aziende" : "persone"] });
                }}
              />
            ) : (
              <h1 className="text-scheda font-semibold tracking-[-0.015em] text-ink">{titolo}</h1>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-ink2">
              <span>
                {fase?.nome ?? t.fase_id}, {euro(t.valore)}
                {t.archiviata_il ? `, archiviata il ${dataCorta(t.archiviata_il)}` : ""}
              </span>
              {ferma === null ? null : <Fermo giorni={ferma} />}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <BottoneWhatsapp trattativa_id={id} />
            {!t.archiviata_il ? (
              <Button variant="outline" onClick={() => setArchivio(true)}>
                <Archive />
                Archivia
              </Button>
            ) : null}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-x-7 gap-y-0.5 xl:grid-cols-2">
          <Campo etichetta="Fase">
            <Scelta
              etichetta="Fase"
              valore={t.fase_id}
              className={SENZA_BORDO}
              opzioni={colonne.map((f) => ({ valore: f.id, etichetta: f.nome }))}
              onScegli={(v) => sposta(t, v)}
            />
          </Campo>
          <Campo etichetta="Segue">
            <Scelta
              etichetta="Segue"
              valore={t.segue}
              vuoto="Nessuno"
              className={SENZA_BORDO}
              opzioni={soci.map((s) => ({ valore: s.email, etichetta: nomeDi(s.email) }))}
              onScegli={(v) => void salva({ segue: v })}
            />
          </Campo>
          <Campo etichetta="Avvio, in euro">
            <Testo key={`avvio-${t.avvio}`} etichetta="Avvio" tipo="number" vuoto="—" valore={t.avvio === null ? "" : String(Number(t.avvio))} onSalva={(v) => void salva({ avvio: numeroDi(v) })} />
          </Campo>
          <Campo etichetta="Canone al mese">
            <Testo key={`canone-${t.canone}`} etichetta="Canone" tipo="number" vuoto="—" valore={t.canone === null ? "" : String(Number(t.canone))} onSalva={(v) => void salva({ canone: numeroDi(v) })} />
          </Campo>
          <Campo etichetta="Valore">
            <span className="px-2 font-medium text-ink tabular-nums" data-valore={t.valore ?? 0}>
              {euro(t.valore)}
            </span>
            <small className="text-xs text-mute">avvio + 12 mesi di canone</small>
          </Campo>
          <Campo etichetta="Temperatura">
            <Scelta
              etichetta="Temperatura"
              valore={t.temperatura}
              vuoto="Non indicata"
              className={SENZA_BORDO}
              opzioni={TEMPERATURE}
              onScegli={(v) => void salva({ temperatura: v })}
            />
          </Campo>
          <Campo etichetta="Prossimo passo">
            <Testo
              key={`passo-${t.prossimo_passo}`}
              etichetta="Prossimo passo"
              vuoto="Scrivi cosa farai dopo"
              obbligatorio={fase?.tipo === "aperta"}
              valore={t.prossimo_passo}
              onSalva={(v) => void salva({ prossimo_passo: v.trim() })}
            />
          </Campo>
          <Campo etichetta="Data">
            <DataOra
              etichetta="Data del prossimo passo"
              svuotabile={fase?.tipo !== "aperta"}
              valore={t.prossimo_il}
              className={cn(SENZA_BORDO, "w-[190px]")}
              onCambia={(v) => void salva({ prossimo_il: v })}
            />
          </Campo>
          {fase?.tipo === "perso" ? (
            <Campo etichetta="Motivo">
              <Scelta
                etichetta="Motivo"
                valore={t.motivo_perso}
                vuoto="Non indicato"
                className={SENZA_BORDO}
                opzioni={MOTIVI_PERSO}
                onScegli={(v) => void salva({ motivo_perso: v })}
              />
            </Campo>
          ) : null}
        </dl>
        <DaDoveScheda azienda={t.azienda_id} />
        <RisposteModulo azienda={t.azienda_id} nota={t.note} onSalva={(v) => void salva({ note: v })} />
        <Timeline trattativa_id={id} />
      </div>
      <aside aria-label="Oggetti collegati" className="bg-rec-side px-5 pt-5 pb-12">
        {azienda ? (
          <Gruppo icona={<Building2 />} titolo="Azienda">
            <Legato a={`/aziende/${azienda.id}`} segno={<LogoAzienda nome={azienda.nome} />} titolo={azienda.nome} sotto={azienda.comune} />
          </Gruppo>
        ) : null}
        {persona ? (
          <Gruppo icona={<Users />} titolo="Persona">
            <Legato a={`/persone/${persona.id}`} segno={<AvatarPersona nome={persona.nome} />} titolo={persona.nome} sotto={persona.ruolo} />
          </Gruppo>
        ) : null}
        <SezioneTag oggetto="trattativa" oggettoId={id} />
      </aside>
      {dialogo}
      {archivio ? (
        <Dialog open onOpenChange={setArchivio}>
          <DialogContent data-richiesta="archivia">
            <DialogHeader>
              <DialogTitle>Archivia la trattativa</DialogTitle>
              <DialogDescription>Esce dalla bacheca e resta nella storia dell'azienda.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setArchivio(false)}>
                Annulla
              </Button>
              <Button onClick={() => void archivia()}>Archivia</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};

const Gruppo = ({ icona, titolo, children }: { icona: ReactNode; titolo: string; children: ReactNode }) => (
  <section className="mb-[22px]">
    <h3 className="mb-1.5 flex items-center gap-2 text-xs font-medium text-mute [&_svg]:size-3.5">
      {icona}
      {titolo}
    </h3>
    {children}
  </section>
);

const RisposteModulo = ({ azienda, nota, onSalva }: { azienda?: string | null; nota: string; onSalva: (v: string) => void }) => {
  const { data: arrivi } = useArriviAzienda(azienda);
  const [apri, setApri] = useState(false);
  if (notaCoperta(nota, arrivi) && !apri) {
    return (
      <button type="button" data-apri-risposte onClick={() => setApri(true)} className="mt-3 text-xs text-mute underline-offset-3 hover:text-ink2 hover:underline">
        Modifica il testo delle risposte
      </button>
    );
  }
  return (
    <div className="mt-4 grid gap-1.5">
      <label htmlFor="note-trattativa" className="text-mute">
        Note
      </label>
      <NoteTrattativa key={`note-${nota}`} valore={nota} onSalva={onSalva} />
    </div>
  );
};

const NoteTrattativa = ({ valore, onSalva }: { valore: string; onSalva: (v: string) => void }) => {
  const [v, setV] = useState(valore);
  return (
    <Textarea
      id="note-trattativa"
      value={v}
      className="max-w-[62ch]"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== valore && onSalva(v)}
    />
  );
};
