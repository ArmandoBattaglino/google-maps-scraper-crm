import { TONO_DI_FASE, type TonoChip } from "@/components/crm/forme";
import type { Fase } from "@/components/crm/forme";

export interface Trattativa {
  id: string;
  azienda_id: string | null;
  persona_id: string | null;
  percorso: string;
  fase_id: string;
  avvio: string | number | null;
  canone: string | number | null;
  valore: string | number | null;
  prossimo_passo: string;
  prossimo_il: string | null;
  segue: string | null;
  mossa_il: string;
  temperatura: string | null;
  motivo_perso: string | null;
  note: string;
  contatto_id: string | null;
  archiviata_il: string | null;
  creato: string;
}

export interface FaseRiga {
  id: string;
  nome: string;
  ordine: number;
  tipo: "aperta" | "cliente" | "perso";
  percorso: string;
}

export interface Percorso {
  id: string;
  nome: string;
  ordine: number;
}

export const MOTIVI_PERSO: { valore: string; etichetta: string }[] = [
  { valore: "non-risponde", etichetta: "Non risponde" },
  { valore: "per-sbaglio", etichetta: "Per sbaglio" },
  { valore: "fuori-target", etichetta: "Fuori target" },
  { valore: "non-si-presenta", etichetta: "Non si presenta" },
  { valore: "prezzo", etichetta: "Prezzo" },
  { valore: "altra-soluzione", etichetta: "Altra soluzione" },
  { valore: "non-convinto", etichetta: "Non convinto" },
  { valore: "altro", etichetta: "Altro" },
];

export const TEMPERATURE = [
  { valore: "caldo", etichetta: "Caldo" },
  { valore: "tiepido", etichetta: "Tiepido" },
  { valore: "freddo", etichetta: "Freddo" },
];

export const numero = (v: string | number | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const euro = (v: string | number | null | undefined): string =>
  `${String(Math.round(numero(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;

export const formaFase = (fase: FaseRiga | undefined, fasi: FaseRiga[]): Fase => {
  if (fase?.tipo === "cliente") return "firmato";
  if (fase?.tipo === "perso") return "perso";
  const aperte = fasi.filter((f) => f.tipo === "aperta");
  const pos = fase ? aperte.findIndex((f) => f.id === fase.id) : 0;
  return (["nuovo", "contattato", "consulenza", "proposta"] as const)[Math.min(Math.max(pos, 0), 3)];
};

export const toniDelleFasi = (fasi: FaseRiga[]): Map<string, TonoChip> => {
  const toni = new Map<string, TonoChip>();
  for (const f of fasi) {
    const tono = TONO_DI_FASE[formaFase(f, fasi.filter((x) => x.percorso === f.percorso))];
    toni.set(f.id, tono);
    if (!toni.has(f.nome)) toni.set(f.nome, tono);
  }
  return toni;
};

export const SEMPRE_APERTE = { "archiviata_il@is": "null" } as const;

export const titoloTrattativa = (azienda?: string, persona?: string): string => azienda || persona || "Senza azienda";
