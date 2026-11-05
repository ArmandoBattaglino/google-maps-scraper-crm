import { Fragment, useState } from "react";
import { Trash2 } from "lucide-react";
import { Confirm } from "@/components/admin/confirm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMenu, VoceMenu } from "@/crm/azioni/MenuRiga";
import { SEGMENTI, type Attivita, type Soggetto, type TipoAttivita } from "./campi";
import { useAttivita, useElimina, useFasi, useNomi } from "./dati";
import { Evento } from "./Evento";
import { etichettaGiorno, giornoDi } from "./tempo";

const PASSO = 50;

const perGiorno = (righe: Attivita[]) => {
  const giorni: { giorno: string; righe: Attivita[] }[] = [];
  for (const a of righe) {
    const giorno = giornoDi(a.quando);
    const ultimo = giorni[giorni.length - 1];
    if (ultimo?.giorno === giorno) ultimo.righe.push(a);
    else giorni.push({ giorno, righe: [a] });
  }
  return giorni;
};

export const Elenco = ({ soggetto, tipo }: { soggetto: Soggetto; tipo: TipoAttivita | null }) => {
  const [quante, setQuante] = useState(PASSO);
  const { data, total, isPending, error, refetch } = useAttivita(soggetto, tipo, quante);
  const righe = data ?? [];
  const nomeDi = useNomi();
  const faseDi = useFasi(righe.some((a) => a.tipo === "fase"));
  const { apri, riga, disegna } = useMenu<Attivita>();
  const [daTogliere, setDaTogliere] = useState<Attivita | null>(null);
  const { togli, togliendo } = useElimina();

  if (isPending) {
    return (
      <div data-timeline-carica aria-label="Sto leggendo la cronologia" className="space-y-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-7 w-3/5" />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div role="alert" data-timeline-errore className="flex items-center gap-3 text-ink2">
        Non riesco a leggere la cronologia.
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Riprova
        </Button>
      </div>
    );
  }
  if (!righe.length) return <p className="text-mute">{SEGMENTI.find((s) => s.tipo === tipo)?.vuoto}</p>;

  return (
    <>
      <ol className="relative before:absolute before:top-1.5 before:bottom-1.5 before:left-[13px] before:w-px before:bg-line">
        {perGiorno(righe).map(({ giorno, righe: delGiorno }) => (
          <Fragment key={giorno}>
            <li data-giorno={giorno} className="mb-3.5 ml-10 text-xs font-medium text-mute">
              {etichettaGiorno(giorno)}
            </li>
            {delGiorno.map((a) => (
              <Evento key={a.id} a={a} nomeDi={nomeDi} faseDi={faseDi} onMenu={apri} />
            ))}
          </Fragment>
        ))}
      </ol>
      {(total ?? 0) > righe.length ? (
        <Button variant="ghost" size="sm" className="ml-10" onClick={() => setQuante((n) => n + PASSO)}>
          Mostra altre ({(total ?? 0) - righe.length})
        </Button>
      ) : null}
      {disegna(riga ? <VoceMenu icona={<Trash2 />} testo="Elimina" pericolo onClick={() => setDaTogliere(riga)} /> : null)}
      <Confirm
        isOpen={daTogliere !== null}
        loading={togliendo}
        title="Eliminare questa riga?"
        content="Sparisce dalla cronologia del CRM. Non si può annullare."
        confirm="Elimina"
        cancel="Annulla"
        onClose={() => setDaTogliere(null)}
        onConfirm={() => {
          if (daTogliere) void togli(daTogliere).then(() => setDaTogliere(null));
        }}
      />
    </>
  );
};
