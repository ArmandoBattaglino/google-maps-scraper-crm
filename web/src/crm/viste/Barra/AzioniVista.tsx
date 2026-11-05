import { useState, type FormEvent } from "react";
import { useGetIdentity, useNotify } from "ra-core";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMenu, VoceMenu } from "@/crm/azioni/MenuRiga";
import { useSoci } from "@/crm/soci";
import { useScriviVista } from "../dati";
import { statoDiPartenza, statoDiVista, TUTTE, type Risorsa, type Vista } from "../stato";
import { conColonneMie } from "../useStatoVista";
import { messaggioDi } from "./forme";

export type VoceElenco = { vista: Vista } | { partenza: Risorsa };

const MASSIMO = 80;

export const nomeCopia = (nome: string, viste: Vista[]): string => {
  const radice = nome.slice(0, MASSIMO - " (copia 999)".length).trim();
  const presi = new Set(viste.map((v) => v.nome.toLowerCase()));
  let prova = `${radice} (copia)`;
  for (let i = 2; presi.has(prova.toLowerCase()); i++) prova = `${radice} (copia ${i})`;
  return prova;
};

const Rinomina = ({ vista, onChiudi }: { vista: Vista; onChiudi: () => void }) => {
  const { rinomina } = useScriviVista();
  const notify = useNotify();
  const [nome, setNome] = useState(vista.nome);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const pulito = nome.trim();

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    if (!pulito || inCorso) return;
    if (pulito === vista.nome) return onChiudi();
    setInCorso(true);
    setErrore(null);
    try {
      await rinomina(vista.id, pulito);
      notify("Vista rinominata", { type: "success" });
      onChiudi();
    } catch (err) {
      setErrore(messaggioDi(err, "Il nome non si è salvato"));
      setInCorso(false);
    }
  };

  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onChiudi()}>
      <DialogContent data-dialogo-vista="rinomina" className="sm:max-w-sm">
        <form onSubmit={(e) => void invia(e)} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Rinomina la vista</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="rinomina-vista">Nome</Label>
            <Input id="rinomina-vista" autoFocus maxLength={MASSIMO} value={nome} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setNome(e.target.value)} />
            {errore ? (
              <p role="alert" className="text-xs text-danger">
                {errore}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onChiudi}>
              Annulla
            </Button>
            <Button type="submit" disabled={!pulito || inCorso}>
              Salva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Elimina = ({ vista, onConferma, onChiudi }: { vista: Vista; onConferma: () => Promise<void>; onChiudi: () => void }) => {
  const { identity } = useGetIdentity();
  const { nomeDi } = useSoci();
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const mia = vista.di === String(identity?.id ?? "").toLowerCase();

  const conferma = async () => {
    setInCorso(true);
    setErrore(null);
    try {
      await onConferma();
      onChiudi();
    } catch (err) {
      setErrore(messaggioDi(err, "La vista non si è eliminata"));
      setInCorso(false);
    }
  };

  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onChiudi()}>
      <DialogContent data-dialogo-vista="elimina" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="break-words">Eliminare «{vista.nome}»?</DialogTitle>
          <DialogDescription>
            Si elimina solo la vista, per tutto il team: aziende, persone, trattative e attività restano come sono.
            {vista.di === "team" ? " È una vista del team." : mia ? "" : ` È una vista di ${nomeDi(vista.di)}.`}
          </DialogDescription>
        </DialogHeader>
        {errore ? (
          <p role="alert" className="text-xs text-danger">
            {errore}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" autoFocus onClick={onChiudi}>
            Annulla
          </Button>
          <Button type="button" variant="destructive" disabled={inCorso} onClick={() => void conferma()}>
            Elimina la vista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const useAzioniVista = ({
  vistaAperta,
  viste,
  onApri,
  chiudiElenco,
}: {
  vistaAperta?: Vista;
  viste: Vista[];
  onApri: (q: { vista: string } | { risorsa: Risorsa }) => void;
  chiudiElenco: () => void;
}) => {
  const { apri, riga, disegna } = useMenu<VoceElenco>();
  const { crea, togli } = useScriviVista();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const [daRinominare, setDaRinominare] = useState<Vista | null>(null);
  const [daEliminare, setDaEliminare] = useState<Vista | null>(null);

  const duplica = async (voce: VoceElenco) => {
    chiudiElenco();
    const nome = "vista" in voce ? voce.vista.nome : TUTTE[voce.partenza];
    const stato = "vista" in voce ? statoDiVista(voce.vista) : conColonneMie(statoDiPartenza(voce.partenza));
    try {
      const nuova = await crea(nomeCopia(nome, viste), String(identity?.id ?? "").toLowerCase(), stato);
      onApri({ vista: nuova.id });
      notify("Vista duplicata: la copia è tua", { type: "success" });
    } catch (err) {
      notify(messaggioDi(err, "La vista non si è duplicata"), { type: "error" });
    }
  };

  const nodo = (
    <>
      {disegna(
        riga === null ? null : "vista" in riga ? (
          <>
            <VoceMenu
              icona={<Pencil />}
              testo="Rinomina"
              onClick={() => {
                chiudiElenco();
                setDaRinominare(riga.vista);
              }}
            />
            <VoceMenu icona={<Copy />} testo="Duplica" onClick={() => void duplica(riga)} />
            <VoceMenu
              icona={<Trash2 />}
              testo="Elimina"
              pericolo
              onClick={() => {
                chiudiElenco();
                setDaEliminare(riga.vista);
              }}
            />
          </>
        ) : (
          <>
            <VoceMenu icona={<Copy />} testo="Duplica" onClick={() => void duplica(riga)} />
            <p data-nota-partenza className="mt-1 border-t border-line px-2 pt-1.5 pb-1 text-xs text-mute">
              È la tabella intera: non si rinomina e non si elimina.
            </p>
          </>
        ),
      )}
      {daRinominare ? <Rinomina vista={daRinominare} onChiudi={() => setDaRinominare(null)} /> : null}
      {daEliminare ? (
        <Elimina
          vista={daEliminare}
          onChiudi={() => setDaEliminare(null)}
          onConferma={async () => {
            const stavaQui = vistaAperta?.id === daEliminare.id;
            await togli(daEliminare.id, () => {
              if (stavaQui) onApri({ risorsa: daEliminare.tabella });
            });
            notify("Vista eliminata: i dati sono tutti lì", { type: "success" });
          }}
        />
      ) : null}
    </>
  );

  const aperta = (voce: VoceElenco) => {
    if (riga === null) return false;
    return "vista" in voce ? "vista" in riga && riga.vista.id === voce.vista.id : "partenza" in riga && riga.partenza === voce.partenza;
  };

  return { apri, aperta, nodo };
};
