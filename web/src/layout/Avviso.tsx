import type { ReactNode } from "react";
import { useMarca } from "@/hooks/useMarca";

export const Avviso = ({ titolo, children, azioni }: { titolo: string; children: ReactNode; azioni?: ReactNode }) => {
  const { iniziale } = useMarca();
  return (
    <main className="grid min-h-svh place-items-center bg-side px-6">
      <section className="w-full max-w-[440px] rounded-lg border border-line bg-background p-7 shadow-carta" role="alert">
        <span className="mb-4 grid size-[22px] place-items-center rounded-[6px] bg-ink text-xs font-semibold text-bg">
          {iniziale}
        </span>
        <h1 className="text-titolo font-semibold tracking-[-0.01em] text-ink">{titolo}</h1>
        <div className="mt-2 space-y-2 text-ink2">{children}</div>
        {azioni ? <div className="mt-6 flex gap-2">{azioni}</div> : null}
      </section>
    </main>
  );
};

export const Attesa = ({ etichetta = "Carico il CRM" }: { etichetta?: string }) => (
  <main className="grid min-h-svh place-items-center bg-background" aria-busy="true">
    <span className="animate-pulse text-titolo tracking-[0.2em] text-mute" role="status" aria-label={etichetta}>
      ...
    </span>
  </main>
);
