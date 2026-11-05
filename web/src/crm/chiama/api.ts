import { fetchUtils, HttpError } from "ra-core";
import { API_URL } from "@/providers/dati";
import type { Attivita } from "@/crm/attivita/campi";

export const chiedi = async <T>(percorso: string, opzioni: RequestInit = {}): Promise<T> => {
  try {
    const { json } = await fetchUtils.fetchJson(`${API_URL}${percorso}`, { ...opzioni, credentials: "same-origin" });
    return json as T;
  } catch (e) {
    const messaggio = e instanceof HttpError ? (e.body as { error?: { message?: string } } | undefined)?.error?.message : "";
    if (messaggio && e instanceof HttpError) throw new HttpError(messaggio, e.status, e.body);
    throw e;
  }
};

const posta = <T>(percorso: string, corpo: unknown = {}) => chiedi<T>(percorso, { method: "POST", body: JSON.stringify(corpo) });

export interface Sorgente {
  vista_id?: string;
  lista_id?: string;
}

export interface AziendaCarta {
  id: string;
  nome: string;
  telefono: string;
  sito: string | null;
  email: string | null;
  indirizzo: string | null;
  comune: string | null;
  categoria: string | null;
  referente: string;
  note: string | null;
  esito: string;
  tentativi: number;
  richiamare_il: string | null;
}

export interface PersonaCarta {
  id: string;
  nome: string;
  ruolo: string;
  telefono: string;
  telefono_norm: string;
  email: string;
}

export interface Carta {
  azienda: AziendaCarta;
  numero: string;
  chi_chiedere: { referente: string; persona: PersonaCarta | null };
  attivita: Attivita[];
  presa: { fino_a: string };
  perche: "richiamo" | "da-chiamare";
  in_coda: number;
}

export type Prossima = Carta | { azienda: null; in_coda: number };

export const haCarta = (p: Prossima | undefined): p is Carta => Boolean(p?.azienda);

export type Esito = "non-risponde" | "richiamare" | "non-interessato" | "interessato";

export interface RispostaEsito {
  attivita: Attivita;
  ripetuto?: boolean;
}

export interface DatiEsito {
  azienda_id: string;
  esito: Esito;
  quando?: string;
  durata?: number;
  testo?: string;
}

export const prossima = (s: Sorgente) => posta<Prossima>("/coda/prossima", s);
export const scriviEsito = (d: DatiEsito) => posta<RispostaEsito>("/coda/esito", d);
export interface DatiFinestra {
  azienda_id: string;
  persona: string;
  prossimo_il: string;
  segue?: string;
  nota?: string;
  chiamata?: { durata?: number };
}
export const apriDaInteressato = (d: DatiFinestra) => posta<{ id: string }>("/trattative/da-azienda", d);

export const rilascia = () => {
  void fetch(`${API_URL}/coda/rilascia`, {
    method: "POST",
    keepalive: true,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => undefined);
};
