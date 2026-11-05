import type { LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Opzione {
  valore: string;
  etichetta: string;
}

export interface GruppoOpzioni {
  chiave: string;
  nome: string;
  icona: LucideIcon;
  opzioni: Opzione[];
}

export const Scelta = ({
  etichetta,
  valore,
  opzioni = [],
  gruppi,
  vuoto = "Scegli",
  onScegli,
  className,
  disabilitata,
}: {
  etichetta: string;
  valore: string | null;
  opzioni?: Opzione[];
  gruppi?: GruppoOpzioni[];
  vuoto?: string;
  onScegli: (v: string) => void;
  className?: string;
  disabilitata?: boolean;
}) => {
  const tutte = [...opzioni, ...(gruppi ?? []).flatMap((g) => g.opzioni)];
  return (
    <Select value={valore ?? ""} onValueChange={(v) => v !== null && onScegli(String(v))} disabled={disabilitata}>
      <SelectTrigger aria-label={etichetta} className={className}>
        <SelectValue placeholder={vuoto}>{(v: string | null) => tutte.find((o) => o.valore === v)?.etichetta ?? vuoto}</SelectValue>
      </SelectTrigger>
      {}
      <SelectContent className={gruppi ? "w-fit min-w-(--anchor-width)" : undefined}>
        {opzioni.map((o) => (
          <SelectItem key={o.valore} value={o.valore}>
            {o.etichetta}
          </SelectItem>
        ))}
        {(gruppi ?? []).map((g, i) => (
          <SelectGroup key={g.chiave} data-gruppo-entita={g.chiave} className={cn("p-0 pt-1.5", (i > 0 || opzioni.length > 0) && "mt-1 border-t border-line")}>
            <SelectLabel className="flex items-center gap-1.5 px-2 pt-0 pb-1 text-sm font-semibold text-ink [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-ink2">
              <g.icona />
              {g.nome}
            </SelectLabel>
            {g.opzioni.map((o) => (
              <SelectItem key={o.valore} value={o.valore} className="pl-7">
                {o.etichetta}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};
