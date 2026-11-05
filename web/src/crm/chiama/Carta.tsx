import { LinkBase } from "ra-core";
import { ExternalLink, Phone } from "lucide-react";
import { Chip, LogoAzienda } from "@/components/crm/forme";
import { buttonVariants } from "@/components/ui/button";
import { ESITI, TIPI } from "@/crm/attivita/campi";
import { useNomi } from "@/crm/attivita/dati";
import { oraDi } from "@/crm/attivita/tempo";
import { dataCorta } from "@/crm/tempo";
import { BottoneWhatsapp } from "@/crm/whatsapp";
import { numeroDi } from "@/crm/whatsapp/testo";
import { cn } from "@/lib/utils";
import type { Carta as DatiCarta } from "./api";
import { Tasto } from "./Esiti";

const MAX_TENTATIVI = 3;

const Motivo = ({ c }: { c: DatiCarta }) => {
  if (c.perche === "richiamo") {
    const il = c.azienda.richiamare_il;
    return <Chip tono="ambra">{il ? `Richiamo del ${dataCorta(il)} alle ${oraDi(il)}` : "Da richiamare"}</Chip>;
  }
  if (c.azienda.tentativi > 0) return <Chip tono="neutro">Tentativo {c.azienda.tentativi + 1} di {MAX_TENTATIVI}</Chip>;
  return <Chip tono="vuoto">Prima chiamata</Chip>;
};

const ChiChiedere = ({ c }: { c: DatiCarta }) => {
  const { persona, referente } = c.chi_chiedere;
  const nome = persona?.nome || referente;
  return (
    <p data-chi-chiedere className="mt-5 text-base text-ink2">
      Chiedi di{" "}
      {nome ? (
        <>
          <strong className="font-semibold text-ink">{nome}</strong>
          {persona?.ruolo ? `, ${persona.ruolo}` : ""}
        </>
      ) : (
        <span>chi decide: nessun referente segnato.</span>
      )}
    </p>
  );
};

const Numero = ({ c, onChiama }: { c: DatiCarta; onChiama: () => void }) =>
  c.numero ? (
    <a
      href={`tel:+${c.numero}`}
      data-tel
      onClick={onChiama}
      className="group mt-1 inline-flex max-w-full items-center gap-3 rounded-md text-[38px] leading-tight font-semibold tracking-[-0.02em] text-ink tabular-nums outline-none hover:text-acc focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Phone className="size-6 shrink-0 text-mute-deco group-hover:text-acc" />
      <span className="truncate">{c.azienda.telefono || `+${c.numero}`}</span>
      <Tasto>C</Tasto>
    </a>
  ) : (
    <p data-senza-telefono className="mt-2 text-base font-medium text-danger">
      Nessun telefono: scrivi un esito o cercalo dalla scheda.
    </p>
  );

const Diretto = ({ c, onChiama }: { c: DatiCarta; onChiama: () => void }) => {
  const persona = c.chi_chiedere.persona;
  const numero = numeroDi(persona ?? undefined);
  if (!persona || !numero || numero === c.numero) return null;
  return (
    <p className="mt-1 text-ink2">
      Diretto di {persona.nome}:{" "}
      <a href={`tel:+${numero}`} data-tel-diretto onClick={onChiama} className="font-medium text-ink tabular-nums hover:text-acc hover:underline">
        {persona.telefono}
      </a>
    </p>
  );
};

const Ultime = ({ c }: { c: DatiCarta }) => {
  const nomeDi = useNomi();
  return (
    <aside aria-label="Ultime attività" className="min-w-0 border-line lg:border-l lg:pl-6">
      <h2 className="text-xs font-medium text-mute">Ultime attività</h2>
      {c.attivita.length ? (
        <ul className="mt-2 space-y-3">
          {c.attivita.map((a) => {
            const tipo = TIPI[a.tipo] ?? TIPI.nota;
            const Icona = tipo.icona;
            const esito = ESITI[a.esito_azienda ?? ""] ?? ESITI[a.esito ?? ""];
            return (
              <li key={a.id} data-ultima className="text-cella">
                <div className="flex items-center gap-2 text-ink2">
                  <Icona className="size-3.5 shrink-0 text-mute-deco" />
                  <span className="truncate">{tipo.nome}</span>
                  {esito ? <Chip tono={esito.tono}>{esito.nome}</Chip> : null}
                </div>
                {a.testo ? <p className="mt-1 line-clamp-3 text-ink">{a.testo}</p> : null}
                <p className="mt-0.5 text-xs text-mute tabular-nums">
                  {dataCorta(a.quando)} alle {oraDi(a.quando)}
                  {a.creato_da ? `, ${nomeDi(a.creato_da)}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-cella text-mute">Nessuna finora: è il primo contatto.</p>
      )}
    </aside>
  );
};

export const Carta = ({
  c,
  nota,
  onNota,
  onChiama,
  notaRef,
}: {
  c: DatiCarta;
  nota: string;
  onNota: (testo: string) => void;
  onChiama: () => void;
  notaRef: React.Ref<HTMLTextAreaElement>;
}) => {
  const a = c.azienda;
  const dove = [a.categoria, a.comune].filter(Boolean).join(", ");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0" aria-live="polite">
        <div className="flex items-center gap-3">
          <LogoAzienda nome={a.nome} grande />
          <div className="min-w-0">
            <h1 data-azienda={a.id} className="truncate text-[22px] leading-tight font-semibold text-ink">
              {a.nome}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-ink2">
              <Motivo c={c} />
              {dove ? <span className="truncate">{dove}</span> : null}
            </div>
          </div>
        </div>
        <ChiChiedere c={c} />
        <Numero c={c} onChiama={onChiama} />
        <Diretto c={c} onChiama={onChiama} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BottoneWhatsapp key={a.id} azienda_id={a.id} />
          <LinkBase to={`/aziende/${a.id}`} target="_blank" className={cn(buttonVariants({ variant: "outline" }))}>
            <ExternalLink />
            Apri la scheda
          </LinkBase>
        </div>
        {a.note ? (
          <section className="mt-5">
            <h2 className="text-xs font-medium text-mute">Note sull'azienda</h2>
            <p data-note className="mt-1 max-w-[72ch] whitespace-pre-line text-ink">
              {a.note}
            </p>
          </section>
        ) : null}
        <label className="mt-5 block">
          <span className="flex items-center gap-2 text-xs font-medium text-mute">
            Nota della chiamata <Tasto>N</Tasto>
          </span>
          <textarea
            ref={notaRef}
            value={nota}
            onChange={(e) => onNota(e.target.value)}
            rows={2}
            maxLength={10_000}
            placeholder="Cosa ha detto? Si salva con l'esito."
            className="mt-1 block w-full max-w-[72ch] resize-y rounded-[7px] border border-line bg-background px-2.5 py-1.5 text-ink outline-none placeholder:text-mute focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      </div>
      <Ultime c={c} />
    </div>
  );
};
