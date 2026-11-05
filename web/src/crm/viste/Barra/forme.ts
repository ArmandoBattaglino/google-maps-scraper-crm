export const FANTASMA =
  "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 whitespace-nowrap text-ink2 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/50 aria-expanded:bg-hover [&_b]:font-medium [&_b]:text-ink [&_svg]:size-3.5 [&_svg]:shrink-0";

export const NESSUNO = "__nessuno__";

export const messaggioDi = (e: unknown, altrimenti: string): string => (e instanceof Error && e.message ? e.message : altrimenti);
