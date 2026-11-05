import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataOra } from "@/crm/DataOra";
import { cn } from "@/lib/utils";
import type { useModifica } from "./useModifica";

export interface Opzione {
  id: string;
  name: string;
}
export type TipoCampo = "testo" | "area" | "scelta" | "numero" | "data" | "dataora";

const SCELTA =
  "h-[30px] w-full rounded-md border border-input bg-background px-2 text-sm text-ink outline-none focus-visible:border-acc focus-visible:ring-3 focus-visible:ring-acc-soft";
const TIPI_INPUT = { testo: "text", numero: "number", data: "date" };

export const Editor = ({
  nome,
  etichetta,
  tipo = "testo",
  opzioni = [],
  m,
  className,
}: {
  nome: string;
  etichetta: string;
  tipo?: TipoCampo;
  opzioni?: Opzione[];
  m: ReturnType<typeof useModifica>;
  className?: string;
}) => {
  const conAvviso = m.avviso !== null && m.avviso !== undefined;
  const fuori = () => {
    if (!conAvviso) void m.salva();
  };
  const tasti = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      m.chiudi();
    } else if (e.key === "Enter" && (tipo !== "area" || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void m.salva();
    }
  };
  const comune = { name: nome, "aria-label": etichetta, autoFocus: true, onBlur: fuori, onKeyDown: tasti };
  return (
    <div className="min-w-0 flex-1">
      {tipo === "scelta" ? (
        <select
          {...comune}
          className={cn(SCELTA, className)}
          value={m.bozza ?? ""}
          onChange={(e) => {
            m.scrivi(e.target.value);
            void m.salva(e.target.value);
          }}
        >
          <option value="">—</option>
          {opzioni.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      ) : tipo === "dataora" ? (
        <DataOra apertoSubito etichetta={etichetta} valore={m.bozza} className={className} onCambia={(v) => void m.salva(v ?? "")} onChiudi={m.chiudi} />
      ) : tipo === "area" ? (
        <Textarea {...comune} className={className} value={m.bozza ?? ""} onChange={(e) => m.scrivi(e.target.value)} />
      ) : (
        <Input
          {...comune}
          className={className}
          type={TIPI_INPUT[tipo]}
          value={m.bozza ?? ""}
          onChange={(e) => m.scrivi(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      )}
      {conAvviso ? (
        <div className="mt-1.5 space-y-2">
          {m.avviso}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void m.salva(m.bozza, { forza: true })}>
              Salva lo stesso
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={m.chiudi}>
              Annulla
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
