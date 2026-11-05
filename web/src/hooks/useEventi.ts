import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

export const EVENTI_URL = "/crm/eventi";

export interface Evento {
  schema: string;
  tabella: string;
  evento?: string;
  id?: string | number;
}

const LISTE = ["aziende", "persone", "elenco-trattative", "compiti"];
const VISTE_COLLEGATE = ["trattative/cerca", "attivita/cerca"];
const ALTRE_RISORSE: Record<string, string[]> = {
  "app.aziende_provenienze": ["origini", ...LISTE],
  "app.attivita": ["attivita", ...LISTE],
  "crm.attivita": ["attivita", ...LISTE],
  "crm.trattative": ["trattative", "origini", "attivita/cerca", "attivita/oggi", ...LISTE],
  "crm.persone": [...LISTE, "origini", ...VISTE_COLLEGATE],
  "app.aziende": [...LISTE, "origini", ...VISTE_COLLEGATE],
  "app.contatti": ["contatti", ...LISTE],
  "crm.schede_aziende": ["schede_aziende", ...LISTE],
  "crm.tag": ["tag", ...LISTE],
  "crm.tag_su": ["tag_su", ...LISTE],
  "crm.campi_definizioni": ["campi_definizioni", ...LISTE],
};

export const risorseDi = (e: Evento): string[] => {
  const extra = ALTRE_RISORSE[`${e.schema}.${e.tabella}`];
  return extra ?? [e.tabella];
};

const leggi = (dati: string): Evento | null => {
  try {
    const e = JSON.parse(dati) as Partial<Evento>;
    return typeof e?.schema === "string" && typeof e?.tabella === "string" ? (e as Evento) : null;
  } catch {
    return null;
  }
};

export function useEventi() {
  const queryClient = useQueryClient();
  useEffect(() => apriEventi(queryClient), [queryClient]);
}

export function apriEventi(queryClient: QueryClient, url = EVENTI_URL): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const stream = new EventSource(url, { withCredentials: true });
  const daRileggere = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let giaAperto = false;

  const svuota = () => {
    timer = undefined;
    for (const risorsa of daRileggere) void queryClient.invalidateQueries({ queryKey: risorsa.split("/") });
    daRileggere.clear();
  };
  const ricevi = (m: MessageEvent<string>) => {
    const e = leggi(m.data);
    if (!e) return;
    for (const r of risorseDi(e)) daRileggere.add(r);
    timer ??= setTimeout(svuota, 100);
  };

  stream.onmessage = ricevi;
  stream.addEventListener("cambio", ricevi as EventListener);
  stream.addEventListener("ripreso", () => void queryClient.invalidateQueries());
  stream.onopen = () => {
    if (giaAperto) void queryClient.invalidateQueries();
    giaAperto = true;
  };

  return () => {
    stream.close();
    if (timer) clearTimeout(timer);
  };
}
