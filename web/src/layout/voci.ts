import type { LucideIcon } from "lucide-react";
import { Layers, Signpost, SlidersHorizontal, SquareCheck, Sun } from "lucide-react";
import { ENTITA, ICONA_ENTITA, NOME_ENTITA, type Entita } from "@/crm/entita";

export interface Voce {
  chiave: string;
  divisore?: boolean;
  etichetta: string;
  percorso: string;
  icona: LucideIcon;
  conta?: string;
  contaFiltro?: Record<string, string>;
}

const DELLE_ENTITA: Partial<Record<Entita, Pick<Voce, "contaFiltro">>> = {
  trattative: { contaFiltro: { "archiviata_il@is": "null" } },
  aziende: {},
  persone: {},
};

const VOCI_ENTITA: Voce[] = ENTITA.flatMap((e) => {
  const d = DELLE_ENTITA[e];
  return d ? [{ chiave: e, etichetta: NOME_ENTITA[e], percorso: `/${e}`, icona: ICONA_ENTITA[e], conta: e, contaFiltro: d.contaFiltro }] : [];
}).map((v, i) => ({ ...v, divisore: i === 0 }));

export const VOCI: Voce[] = [
  {
    chiave: "oggi",
    etichetta: "Oggi",
    percorso: "/",
    icona: Sun,
  },
  {
    chiave: "viste",
    etichetta: "Viste",
    percorso: "/viste",
    icona: Layers,
  },
  {
    chiave: "compiti",
    etichetta: "Compiti",
    percorso: "/compiti",
    icona: SquareCheck,
  },
  ...VOCI_ENTITA,
  {
    chiave: "origini",
    etichetta: "Origini",
    percorso: "/origini",
    icona: Signpost,
    conta: "origini",
  },
  {
    chiave: "campi",
    etichetta: "Campi personalizzati",
    percorso: "/campi",
    icona: SlidersHorizontal,
  },
];

export const voce = (chiave: string): Voce => {
  const v = VOCI.find((x) => x.chiave === chiave);
  if (!v) throw new Error(`voce sconosciuta: ${chiave}`);
  return v;
};
