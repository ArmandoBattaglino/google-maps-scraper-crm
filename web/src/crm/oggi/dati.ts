import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { chiedi } from "@/crm/chiama/api";

export type Di = "me" | "team";
export type Risorsa = "aziende" | "trattative" | "attivita";
export type Filtri = unknown;

export interface Numero {
  n: number;
  risorsa: Risorsa;
  filtri: Filtri;
}

export interface RigaDaFare {
  chiave: string;
  tipo: "trattativa" | "richiamo" | "compito";
  id: string;
  scheda: { risorsa: "trattative" | "aziende" | "persone"; id: string };
  cosa: string;
  quando: string | null;
  scaduto: boolean;
  azienda: string | null;
  persona: string | null;
  chi: string | null;
  compiti: string[];
}

export interface RigaTrattativa {
  id: string;
  azienda_id: string | null;
  fase_id: string;
  segue: string | null;
  prossimo_passo: string | null;
  prossimo_il: string | null;
  mossa_il: string;
  ferma_da?: number;
  "azienda.nome": string | null;
  "persona.nome": string | null;
  "fase.nome": string | null;
}

export type Conti = { totale: number } & Record<string, number>;

export interface Socio {
  email: string;
  nome: string;
  oggi: Conti;
  settimana: Conti;
}

export interface Oggi {
  di: Di;
  oggi: string;
  da_chiamare: Numero;
  da_fare: { n: number; scaduti: number; oggi: number; max: number; righe: RigaDaFare[]; fonti?: { compiti?: Numero } };
  ferme: Numero & { soglia_di_base: number; righe: RigaTrattativa[]; altre: Numero & { righe: RigaTrattativa[] } };
  senza_passo: Numero & { righe: RigaTrattativa[] };
  settimana: { da: string; a: string; consulenze_fissate: Numero; proposte_inviate: Numero; firme: Numero };
  chi_ha_fatto: {
    soci: Socio[];
    totali: { oggi: Conti; settimana: Conti };
    filtri: { oggi: Filtri; settimana: Filtri };
  };
}

const leggi = async (di: Di, signal: AbortSignal) => {
  const d = await chiedi<Oggi>(`/oggi?di=${di}`, { signal });
  if (!d?.da_chiamare) throw new Error("Il cruscotto ha risposto senza i numeri.");
  return d;
};

export const useOggi = (di: Di) =>
  useQuery({
    queryKey: ["attivita", "oggi", di],
    queryFn: ({ signal }) => leggi(di, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    retry: 1,
  });

export interface Voce extends Numero {
  titolo: string;
  ordine: { campo: string; dir: "asc" | "desc" }[];
}

const PER_QUANDO = [{ campo: "quando", dir: "desc" as const }];
const PER_MOSSA = [{ campo: "mossa_il", dir: "asc" as const }];

const fatte = (o: Oggi, periodo: "oggi" | "settimana", socio: string | null, tipo: string | null): Voce => {
  const riga = socio ? o.chi_ha_fatto.soci.find((s) => s.email === socio) : null;
  const conti = socio ? riga?.[periodo] : o.chi_ha_fatto.totali[periodo];
  const nodi = [
    o.chi_ha_fatto.filtri[periodo],
    ...(socio ? [{ campo: "creato_da", op: "uguale", valore: socio }] : []),
    ...(tipo ? [{ campo: "tipo", op: "uguale", valore: tipo }] : []),
  ];
  const cosa = tipo === "chiamata" ? "Chiamate" : "Attività";
  return {
    titolo: `${cosa} ${periodo === "oggi" ? "di oggi" : "della settimana"}${riga ? `, ${riga.nome}` : ""}`,
    risorsa: "attivita",
    filtri: { e: nodi },
    n: (tipo ? conti?.[tipo] : conti?.totale) ?? 0,
    ordine: PER_QUANDO,
  };
};

export const voceDi = (o: Oggi, chiave: string, socio: string | null = null, tipo: string | null = null): Voce | null => {
  const s = o.settimana;
  switch (chiave) {
    case "da-chiamare":
      return { titolo: "Da chiamare", ...o.da_chiamare, ordine: [{ campo: "tentativi", dir: "asc" }, { campo: "nome", dir: "asc" }] };
    case "ferme":
      return { titolo: "Trattative ferme", ...o.ferme, ordine: PER_MOSSA };
    case "ferme-altre":
      return { titolo: "Altre trattative ferme", ...o.ferme.altre, ordine: PER_MOSSA };
    case "senza-passo":
      return { titolo: "Senza prossimo passo", ...o.senza_passo, ordine: PER_MOSSA };
    case "consulenze":
      return { titolo: "Appuntamenti fissati", ...s.consulenze_fissate, ordine: PER_QUANDO };
    case "proposte":
      return { titolo: "Proposte inviate", ...s.proposte_inviate, ordine: PER_QUANDO };
    case "firme":
      return { titolo: "Firme", ...s.firme, ordine: PER_QUANDO };
    case "fatte-oggi":
      return fatte(o, "oggi", socio, tipo);
    case "fatte-settimana":
      return fatte(o, "settimana", socio, tipo);
    default:
      return null;
  }
};

export const linkA = (di: Di, chiave: string, altro: { socio?: string; tipo?: string } = {}) => {
  const q = new URLSearchParams();
  if (di === "team") q.set("di", "team");
  if (altro.socio) q.set("socio", altro.socio);
  if (altro.tipo) q.set("tipo", altro.tipo);
  const s = q.toString();
  return `/oggi/${chiave}${s ? `?${s}` : ""}`;
};
