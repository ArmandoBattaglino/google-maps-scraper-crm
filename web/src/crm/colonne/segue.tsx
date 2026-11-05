import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSoci } from "@/crm/soci";
import type { DatiCrm } from "@/providers/dati";
import { Socio, type Stato } from "./celle";

export type DestinoSegue = { su: "trattativa"; id: string; altre?: number } | { su: "azienda"; id: string } | null;

export const destinoDaStato = (stato: Stato | null | undefined, azienda?: string | null): DestinoSegue => {
  if (stato?.trattativa_id) return stato.tipo === "aperta" && !stato.archiviata ? { su: "trattativa", id: stato.trattativa_id, altre: stato.altre_aperte } : null;
  return azienda ? { su: "azienda", id: azienda } : null;
};

export const RILETTE = ["aziende", "persone", "trattative", "elenco-trattative", "schede_aziende"];

export const useScriviSegue = () => {
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  return async (d: NonNullable<DestinoSegue>, segue: string | null) => {
    await dp.patch(d.su === "trattativa" ? "trattative" : "aziende", { id: d.id, data: { segue } });
    await Promise.all(RILETTE.map((queryKey) => qc.invalidateQueries({ queryKey: [queryKey] })));
  };
};

export const SuPiuRecente = ({ altre }: { altre?: number }) =>
  altre ? (
    <span data-segue-altre title={`Ci sono ${altre + 1} trattative aperte: questa è la più recente, e si scrive lì`} className="pl-1.5 text-xs whitespace-nowrap text-mute">
      più recente
    </span>
  ) : null;

export const SceltaSegue = ({ valore, onScegli, children }: { valore?: string | null; onScegli: (v: string | null) => Promise<unknown>; children: ReactNode }) => {
  const { soci } = useSoci();
  const notify = useNotify();
  const [aperto, setAperto] = useState(false);
  const scegli = async (v: string | null) => {
    setAperto(false);
    if (v === (valore ?? null)) return;
    try {
      await onScegli(v);
    } catch (e) {
      notify(`Non si è salvato: ${e instanceof Error ? e.message : "errore del servizio"}`, { type: "error" });
    }
  };
  const voce = "block w-full truncate rounded-md px-2 py-1.5 text-left text-ink outline-none hover:bg-hover focus-visible:bg-hover";
  return (
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <Popover open={aperto} onOpenChange={setAperto}>
        <PopoverTrigger data-segue-modifica aria-label="Cambia chi segue" className="-mx-1 inline-flex min-h-6 max-w-full cursor-pointer items-center rounded-md px-1 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/50">
          {children}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[220px] p-1" onClick={(e) => e.stopPropagation()}>
          <div role="listbox" aria-label="Segue">
            {soci.map((s) => (
              <button key={s.email} type="button" role="option" aria-selected={s.email.toLowerCase() === valore?.toLowerCase()} className={voce} onClick={() => void scegli(s.email.toLowerCase())}>
                {s.nome || s.email}
              </button>
            ))}
            <button type="button" role="option" aria-selected={!valore} className={`${voce} text-mute`} onClick={() => void scegli(null)}>
              Nessuno
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
};

export const CellaSegue = ({ valore, destino }: { valore?: string | null; destino: DestinoSegue }) => {
  const { nomeDi } = useSoci();
  const scrivi = useScriviSegue();
  const socio = <Socio v={nomeDi(valore)} />;
  if (!destino) return <span title="Solo trattative chiuse o archiviate: si cambia dalla trattativa">{socio}</span>;
  return (
    <>
      <SceltaSegue valore={valore} onScegli={(v) => scrivi(destino, v)}>
        {socio}
      </SceltaSegue>
      {destino.su === "trattativa" ? <SuPiuRecente altre={destino.altre} /> : null}
    </>
  );
};
