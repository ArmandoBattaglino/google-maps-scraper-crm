import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Chip } from "@/components/crm/forme";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { chiedi } from "@/crm/chiama/api";
import { dataEOra } from "@/crm/tempo";
import { nomeVoce, type DettaglioOrigine } from "./voci";

const Riga = ({ etichetta, children }: { etichetta: string; children: ReactNode }) =>
  children === "" || children === null || children === undefined ? null : (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 py-[3px]" data-riga-pannello={etichetta}>
      <dt className="text-mute">{etichetta}</dt>
      <dd className="m-0 min-w-0 break-words whitespace-pre-line text-ink">{children}</dd>
    </div>
  );

const Sezione = ({ titolo, children }: { titolo: string; children: ReactNode }) => (
  <section className="border-t border-line2 pt-2.5 first:border-t-0 first:pt-0">
    <h3 className="mb-1 text-xs font-medium text-mute">{titolo}</h3>
    <dl className="m-0">{children}</dl>
  </section>
);

const Corpo = ({ o, onChiudi }: { o: DettaglioOrigine; onChiudi: () => void }) => {
  const k = o.contatto;
  const risposte = o.risposte_modulo ?? [];
  const form = [k?.nome, k?.telefono, k?.email, k?.azienda].some(Boolean) || risposte.length > 0;
  const haRicerca = o.parola || o.luogo || o.zona || o.metodo || o.fonte || o.lista_nome || o.volte > 1;
  return (
    <div className="grid gap-5">
      <div className="grid content-start gap-3 text-cella">
        <Sezione titolo="L'arrivo">
          <Riga etichetta="Tipo">{o.prima ? <Chip tono="blu">Origine</Chip> : <Chip>Ritorno</Chip>}</Riga>
          <Riga etichetta="Canale">{nomeVoce(o.voce)}</Riga>
          <Riga etichetta="Quando">{dataEOra(o.quando)}</Riga>
          <Riga etichetta={o.voce === "evento" ? "Quale" : "Da chi"}>{o.da_chi}</Riga>
          <Riga etichetta="Azienda">
            <Link to={`/aziende/${o.azienda_id}`} onClick={onChiudi} className="text-ink underline-offset-3 hover:underline">
              {o.azienda_nome}
            </Link>
          </Riga>
          {o.persona_id ? (
            <Riga etichetta="Persona">
              <Link to={`/persone/${o.persona_id}`} onClick={onChiudi} className="text-ink underline-offset-3 hover:underline">
                {o.persona_nome}
              </Link>
            </Riga>
          ) : null}
          {o.trattativa_id ? (
            <Riga etichetta="Trattativa">
              <Link to={`/trattative/${o.trattativa_id}`} onClick={onChiudi} className="text-ink underline-offset-3 hover:underline">
                {o.fase_nome ?? "Apri"}
              </Link>
            </Riga>
          ) : null}
        </Sezione>
        {form ? (
          <Sezione titolo="I campi del form">
            <Riga etichetta="Nome">{k?.nome}</Riga>
            <Riga etichetta="Telefono">{k?.telefono}</Riga>
            <Riga etichetta="Email">{k?.email}</Riga>
            <Riga etichetta="Azienda inserita">{k?.azienda}</Riga>
            {risposte.map((r, i) => (
              <Riga key={`${i}-${r.d}`} etichetta={r.d}>
                {r.r}
              </Riga>
            ))}
          </Sezione>
        ) : null}
        {o.risposte && !risposte.length ? (
          <Sezione titolo="Quello che ha scritto">
            <div data-testo-lead className="text-ink break-words whitespace-pre-line">
              {o.risposte}
            </div>
          </Sezione>
        ) : null}
        {haRicerca ? (
          <Sezione titolo="La ricerca">
            <Riga etichetta="Lista">{o.lista_nome}</Riga>
            <Riga etichetta="Parola">{o.parola}</Riga>
            <Riga etichetta="Luogo">{o.luogo}</Riga>
            <Riga etichetta="Zona">{o.zona}</Riga>
            <Riga etichetta="Fonte">{o.fonte}</Riga>
            {o.voce === "evento" ? null : <Riga etichetta="Metodo">{o.metodo}</Riga>}
            {o.volte > 1 ? <Riga etichetta="Volte">{o.volte}</Riga> : null}
          </Sezione>
        ) : null}
      </div>
    </div>
  );
};

export const PannelloOrigine = ({ id, onChiudi }: { id: string; onChiudi: () => void }) => {
  const { data, isPending, error } = useQuery({
    queryKey: ["origini", "una", id],
    queryFn: () => chiedi<DettaglioOrigine>(`/origini/${encodeURIComponent(id)}`),
  });
  return (
    <span onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <Dialog open onOpenChange={(aperto) => !aperto && onChiudi()}>
        <DialogContent data-pannello-origine className="max-h-[90vh] overflow-y-auto sm:max-w-[920px]">
          <DialogHeader>
            <DialogTitle>{data ? `Da dove: ${data.azienda_nome}` : "Da dove"}</DialogTitle>
          </DialogHeader>
          {isPending ? (
            <span role="status" aria-label="Carico" className="animate-pulse tracking-[0.2em] text-mute">
              ...
            </span>
          ) : error || !data ? (
            <p className="text-danger" role="alert">
              Non riesco a leggere questo arrivo.
            </p>
          ) : (
            <Corpo o={data} onChiudi={onChiudi} />
          )}
        </DialogContent>
      </Dialog>
    </span>
  );
};
