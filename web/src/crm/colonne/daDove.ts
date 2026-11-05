import { nomeVoce, SCRAPING_MAPS, type Voce } from "@/crm/origini/voci";

export interface Arrivo {
  id: string;
  voce: Voce;
  quando?: string;
  parola?: string;
  luogo?: string;
  zona?: string;
  da_chi?: string;
  ritorni?: number;
}

export interface DatiDaDove {
  arrivo?: Arrivo;
  fonte?: string;
  lista?: string;
  raccolta?: string;
  origine?: string;
  maps?: boolean;
  provenienze?: { parola?: string; luogo?: string; zona?: string }[];
  ricerche?: number;
}

export interface DueRighe {
  sopra: string;
  sotto?: string;
}

const insieme = (...pezzi: (string | undefined)[]) => pezzi.filter(Boolean).join(" · ");

const NATA_QUI = new Set(["CRM"]);
const A_FREDDO = "Chiamata a freddo";

const raccolta = (d: DatiDaDove): string | undefined => {
  const nome = d.raccolta ?? (d.origine && d.origine !== "lead" ? d.origine : undefined);
  if (d.maps || nome === "google-maps") return SCRAPING_MAPS;
  return nome;
};

const daRitorni = (n?: number) => (n ? `+${n} ${n === 1 ? "ritorno" : "ritorni"}` : undefined);

const dalRegistro = (a: Arrivo, d: DatiDaDove): DueRighe => {
  if (a.voce === "freddo") {
    if (a.parola) return { sopra: SCRAPING_MAPS, sotto: d.lista ?? insieme(a.parola, a.zona || a.luogo) };
    return { sopra: d.lista ?? raccolta(d) ?? nomeVoce(a.voce) };
  }
  return { sopra: insieme(nomeVoce(a.voce), a.da_chi), sotto: daRitorni(a.ritorni) };
};

export const daDove = (d?: DatiDaDove | null): DueRighe => {
  const dati = d ?? {};
  if (dati.arrivo) return dalRegistro(dati.arrivo, dati);
  const fonte = dati.fonte?.trim() ?? "";
  if (fonte && !NATA_QUI.has(fonte) && fonte !== A_FREDDO) return { sopra: fonte };
  const trovata = raccolta(dati);
  const ricerca = dati.provenienze?.find((p) => p.parola);
  if (ricerca?.parola) return { sopra: SCRAPING_MAPS, sotto: dati.lista ?? insieme(ricerca.parola, ricerca.zona || ricerca.luogo) };
  if (dati.lista) return { sopra: dati.lista, sotto: trovata };
  if (trovata) return { sopra: trovata };
  if (fonte === A_FREDDO) return { sopra: A_FREDDO };
  return { sopra: "Creata nel CRM" };
};
