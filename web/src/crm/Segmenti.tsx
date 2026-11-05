import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Segmento<V extends string> {
  valore: V;
  etichetta: ReactNode;
}

export const Segmenti = <V extends string>({
  etichetta,
  opzioni,
  valore,
  onScegli,
}: {
  etichetta: string;
  opzioni: Segmento<V>[];
  valore: V;
  onScegli: (v: V) => void;
}) => (
  <div role="group" aria-label={etichetta} className="inline-flex rounded-lg bg-hover p-0.5">
    {opzioni.map((o) => (
      <button
        key={o.valore}
        type="button"
        aria-pressed={o.valore === valore}
        onClick={() => onScegli(o.valore)}
        className={cn(
          "inline-flex h-[26px] items-center gap-1.5 rounded-[6px] px-2.5 whitespace-nowrap text-ink2 [&_svg]:size-3.5",
          o.valore === valore && "bg-background text-ink shadow-seg",
        )}
      >
        {o.etichetta}
      </button>
    ))}
  </div>
);
