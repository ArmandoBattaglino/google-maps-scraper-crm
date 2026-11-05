import { useEffect, useId, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvvisoChiave, AvvisoUsate } from "./AvvisiCampo";
import { EditorOpzioni, opzioniDa, problemaOpzioni, rigaVuota, righeDa, type RigaOpzione } from "./EditorOpzioni";
import { ScegliTipo, TipoFisso } from "./ScegliTipo";
import type { Campi } from "./useCampi";
import { chiaveDa, conOpzioni, erroreDi, type Definizione, type ErroreCampo, type Tipo } from "./tipi";

const MAX_ETICHETTA = 80;

const problemaEtichetta = (v: string) => {
  if (!v.trim()) return "Scrivi il nome del campo.";
  return v.trim().length > MAX_ETICHETTA ? `Il nome sta in ${MAX_ETICHETTA} caratteri.` : null;
};

export const PannelloCampo = ({
  campo,
  campi,
  onChiudi,
}: {
  campo?: Definizione;
  campi: Campi;
  onChiudi: () => void;
}) => {
  const idEtichetta = useId();
  const [etichetta, setEtichetta] = useState(campo?.etichetta ?? "");
  const [tipo, setTipo] = useState<Tipo>(campo?.tipo ?? "testo");
  const [righe, setRighe] = useState<RigaOpzione[]>(() => (campo ? righeDa(campo.opzioni) : [rigaVuota()]));
  const [provato, setProvato] = useState(false);
  const [toccata, setToccata] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<ErroreCampo | null>(null);

  const chiave = campo?.chiave ?? chiaveDa(etichetta);
  const haOpzioni = conOpzioni(tipo);
  const maleEtichetta = provato || toccata ? problemaEtichetta(etichetta) : null;
  const maleOpzioni = haOpzioni && provato ? problemaOpzioni(righe) : null;

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !salvando) onChiudi();
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [salvando, onChiudi]);

  const salva = async (chiaveScelta = chiave) => {
    if (salvando) return;
    setProvato(true);
    if (problemaEtichetta(etichetta) || (haOpzioni && problemaOpzioni(righe))) return;
    setSalvando(true);
    setErrore(null);
    const opzioni = haOpzioni ? opzioniDa(righe) : undefined;
    try {
      if (campo) await campi.modifica(campo, { etichetta: etichetta.trim(), opzioni });
      else await campi.crea({ chiave: chiaveScelta, etichetta: etichetta.trim(), tipo, opzioni: opzioni ?? [] });
      onChiudi();
    } catch (e) {
      setErrore(erroreDi(e));
      setSalvando(false);
    }
  };

  const invia = (e: FormEvent) => {
    e.preventDefault();
    void salva();
  };

  const fai = async (gesto: Promise<void>) => {
    try {
      await gesto;
      onChiudi();
    } catch (e) {
      setErrore(erroreDi(e));
    }
  };

  const titolo = campo ? campo.etichetta : "Nuovo campo";
  return (
    <aside
      aria-label={titolo}
      data-pannello={campo ? "modifica" : "nuovo"}
      className="border-t border-line bg-rec-side lg:border-t-0 lg:border-l"
    >
      <div className="px-5 pt-[18px] pb-10 duration-150 animate-in fade-in slide-in-from-right-2 motion-reduce:animate-none lg:sticky lg:top-0 lg:max-h-[calc(100svh-var(--testata))] lg:overflow-auto">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{titolo}</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Chiudi il pannello" onClick={onChiudi}>
          <X />
        </Button>
      </div>

      <form onSubmit={invia} noValidate className="mt-3">
        <label htmlFor={idEtichetta} className="text-xs font-medium text-mute">
          Nome
        </label>
        <Input
          id={idEtichetta}
          className="mt-1"
          autoFocus
          placeholder="Settore"
          value={etichetta}
          aria-invalid={!!maleEtichetta}
          onBlur={() => setToccata(true)}
          onChange={(e) => {
            setEtichetta(e.target.value);
            setErrore(null);
          }}
        />
        {maleEtichetta ? (
          <p role="alert" className="mt-1 text-cella text-danger">
            {maleEtichetta}
          </p>
        ) : null}
        {etichetta.trim() || campo ? (
          <p className="mt-1 text-cella text-mute" data-chiave={chiave}>
            Chiave interna <span className="text-ink2">{chiave}</span>
            {campo ? ": non cambia, anche se cambi il nome." : ": dopo il salvataggio non cambia più."}
          </p>
        ) : null}

        {campo ? <TipoFisso tipo={campo.tipo} /> : <ScegliTipo valore={tipo} onCambia={setTipo} />}

        {haOpzioni ? (
          <EditorOpzioni
            righe={righe}
            errore={maleOpzioni}
            onCambia={(r) => {
              setRighe(r);
              setErrore(null);
            }}
          />
        ) : null}

        {errore?.codice === "chiave" ? (
          <AvvisoChiave
            chiave={chiave}
            messaggio={errore.messaggio}
            tutte={campi.tutte}
            onRipristina={(d) => void fai(campi.ripristina(d))}
            onCreaCon={(c) => void salva(c)}
          />
        ) : null}
        {errore?.codice === "opzione_usata" ? (
          <AvvisoUsate
            usate={errore.usate ?? []}
            onRimetti={() => {
              setRighe([...righe.filter((r) => r.valore.trim()), ...(errore.usate ?? []).map((u) => rigaVuota(u.valore))]);
              setErrore(null);
            }}
          />
        ) : null}
        {errore && errore.codice !== "chiave" && errore.codice !== "opzione_usata" ? (
          <p role="alert" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2 text-cella text-danger">
            {errore.messaggio}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-1.5">
          <Button type="submit" aria-busy={salvando}>
            {campo ? "Salva" : "Crea campo"}
          </Button>
          <Button type="button" variant="ghost" onClick={onChiudi}>
            Annulla
          </Button>
          {campo ? (
            <Button type="button" variant="ghost" className="ml-auto" onClick={() => void fai(campi.archivia(campo))}>
              Archivia
            </Button>
          ) : null}
        </div>
      </form>
      </div>
    </aside>
  );
};
