import type { MouseEvent, ReactNode } from "react";
import { hrefEmail, hrefTelefono } from "./campi";

const nonAprireLaRiga = (e: MouseEvent) => e.stopPropagation();

export const Assente = () => <span className="text-assente">—</span>;

export const Puntini = ({ etichetta }: { etichetta: string }) => (
  <span className="animate-pulse tracking-[0.2em] text-mute" role="status" aria-label={etichetta}>
    ...
  </span>
);

const Collegamento = ({ href, children }: { href?: string; children: ReactNode }) =>
  href ? (
    <a href={href} onClick={nonAprireLaRiga} className="text-acc-ink hover:underline">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );

export const LinkTelefono = ({ valore }: { valore?: string | null }) =>
  valore ? <Collegamento href={hrefTelefono(valore)}>{valore}</Collegamento> : <Assente />;

export const LinkEmail = ({ valore }: { valore?: string | null }) =>
  valore ? <Collegamento href={hrefEmail(valore)}>{valore}</Collegamento> : <Assente />;
