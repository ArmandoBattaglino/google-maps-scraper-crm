export type Voce = "freddo" | "mano" | "passaparola" | "evento";

export const VOCI: { valore: Voce; etichetta: string }[] = [
  { valore: "freddo", etichetta: "Liste a freddo" },
  { valore: "mano", etichetta: "A mano" },
  { valore: "passaparola", etichetta: "Passaparola" },
  { valore: "evento", etichetta: "Evento o incontro" },
];

export const SCRAPING_MAPS = "Scraping: Google Maps";

export const nomeVoce = (v?: string | null): string => VOCI.find((x) => x.valore === v)?.etichetta ?? "";

export interface RispostaModulo {
  d: string;
  r: string;
}

export interface RigaOrigine {
  id: string;
  azienda_id: string;
  azienda_nome: string;
  persona_id?: string | null;
  persona_nome?: string | null;
  trattativa_id?: string | null;
  fase_id?: string | null;
  fase_nome?: string | null;
  fase_tipo?: string | null;
  trattativa_archiviata?: string | null;
  prima: boolean;
  voce: Voce;
  quando: string;
  ultima_vista?: string | null;
  volte: number;
  parola: string;
  luogo: string;
  zona: string;
  fonte: string;
  metodo: string;
  da_chi: string;
  risposte_modulo?: RispostaModulo[] | null;
  lista?: string | null;
  maps?: string | null;
  risposte: string;
}

export interface DettaglioOrigine extends RigaOrigine {
  lista_nome?: string | null;
  contatto?: { nome?: string; telefono?: string; email?: string; azienda?: string } | null;
}
