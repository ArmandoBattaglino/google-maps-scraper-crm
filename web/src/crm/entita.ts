import type { LucideIcon } from "lucide-react";
import { Activity, Building2, Target, Users } from "lucide-react";

export const ENTITA = ["trattative", "aziende", "persone", "attivita"] as const;
export type Entita = (typeof ENTITA)[number];

export const PRIMA_ENTITA: Entita = ENTITA[0];

export const NOME_ENTITA: Record<Entita, string> = {
  trattative: "Trattative",
  aziende: "Aziende",
  persone: "Persone",
  attivita: "Attività",
};

export const ICONA_ENTITA: Record<Entita, LucideIcon> = {
  trattative: Target,
  aziende: Building2,
  persone: Users,
  attivita: Activity,
};

export const inOrdine = <T,>(righe: readonly T[], entita: (riga: T) => Entita): T[] =>
  [...righe].sort((a, b) => ENTITA.indexOf(entita(a)) - ENTITA.indexOf(entita(b)));
