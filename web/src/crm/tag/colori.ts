import type { TonoChip } from "@/components/crm/forme";

export interface ColoreTag {
  tono: TonoChip;
  nome: string;
  token: string | null;
  campione: string;
}

export const COLORI: ColoreTag[] = [
  { tono: "neutro", nome: "grigio", token: null, campione: "bg-mute-deco" },
  { tono: "blu", nome: "blu", token: "--acc-ink", campione: "bg-acc-ink" },
  { tono: "verde", nome: "verde", token: "--esito-interessato", campione: "bg-esito-interessato" },
  { tono: "ambra", nome: "ambra", token: "--esito-richiamare", campione: "bg-esito-richiamare" },
  { tono: "rosso", nome: "rosso", token: "--danger", campione: "bg-danger" },
  { tono: "viola", nome: "viola", token: "--esito-proposta", campione: "bg-esito-proposta" },
];

const valoreDi = (token: string): string | null => {
  const letto = getComputedStyle(document.documentElement).getPropertyValue(token).trim().toLowerCase();
  const lungo = letto.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3");
  return /^#[0-9a-f]{6}$/.test(lungo) ? lungo : null;
};

export const coloreDaSalvare = (c: ColoreTag): string | undefined => (c.token ? (valoreDi(c.token) ?? undefined) : undefined);

export const tonoDi = (colore?: string | null): TonoChip => {
  const cercato = colore?.toLowerCase();
  return COLORI.find((c) => c.token && valoreDi(c.token) === cercato)?.tono ?? "neutro";
};
