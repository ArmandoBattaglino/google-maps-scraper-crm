import type { ReactNode } from "react";

export const Testata = ({ titolo, conteggio, azioni }: { titolo: ReactNode; conteggio?: ReactNode; azioni?: ReactNode }) => (
  <div className="flex items-center gap-3 px-6 pt-[18px] pb-3">
    <h1 className="text-titolo font-semibold tracking-[-0.01em] text-ink">{titolo}</h1>
    {conteggio !== undefined && conteggio !== null ? <span className="text-mute tabular-nums">{conteggio}</span> : null}
    {azioni ? <div className="ml-auto flex items-center gap-2">{azioni}</div> : null}
  </div>
);
