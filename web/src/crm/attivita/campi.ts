import type { LucideIcon } from "lucide-react";
import { Handshake, Mail, MessageCircle, MessagesSquare, MoveRight, Phone, SquareCheck, StickyNote } from "lucide-react";
import type { TonoChip } from "@/components/crm/forme";

export type TipoAttivita = "chiamata" | "nota" | "email" | "compito" | "whatsapp" | "messaggio" | "meet" | "fase";

export interface Attivita {
  id: string;
  tipo: TipoAttivita;
  azienda_id: string | null;
  persona_id: string | null;
  trattativa_id: string | null;
  esito: string | null;
  esito_azienda: string | null;
  testo: string;
  scadenza: string | null;
  fatto_il: string | null;
  durata: number | null;
  fase: string | null;
  quando: string;
  creato_da: string | null;
  assegnato_a?: string | null;
}

export type Soggetto =
  | { azienda_id: string; persona_id?: never; trattativa_id?: never }
  | { persona_id: string; azienda_id?: never; trattativa_id?: never }
  | { trattativa_id: string; azienda_id?: never; persona_id?: never };

export interface Legami {
  azienda_id: string | null;
  persona_id: string | null;
  trattativa_id: string | null;
}

export const SEGMENTI: { etichetta: string; tipo: TipoAttivita | null; vuoto: string }[] = [
  { etichetta: "Tutto", tipo: null, vuoto: "Ancora nessuna attività. Scrivi la prima nota qui sopra." },
  { etichetta: "Chiamate", tipo: "chiamata", vuoto: "Nessuna chiamata registrata." },
  { etichetta: "Note", tipo: "nota", vuoto: "Nessuna nota." },
  { etichetta: "Compiti", tipo: "compito", vuoto: "Nessun compito." },
];

export const TIPI: Record<TipoAttivita, { icona: LucideIcon; azione: string; nome: string; tinta: string }> = {
  chiamata: { icona: Phone, azione: "ha chiamato", nome: "Chiamata", tinta: "bg-tipo-chiamata-soft text-tipo-chiamata" },
  nota: { icona: StickyNote, azione: "ha scritto una nota", nome: "Nota", tinta: "bg-tipo-nota-soft text-tipo-nota ring-1 ring-inset ring-tipo-nota-line" },
  email: { icona: Mail, azione: "ha mandato un'email", nome: "Email", tinta: "bg-tipo-email-soft text-tipo-email" },
  compito: { icona: SquareCheck, azione: "ha creato un compito", nome: "Compito", tinta: "bg-tipo-compito-soft text-tipo-compito" },
  whatsapp: { icona: MessageCircle, azione: "ha scritto su WhatsApp", nome: "WhatsApp", tinta: "bg-tipo-whatsapp-soft text-tipo-whatsapp" },
  messaggio: { icona: MessagesSquare, azione: "ha mandato un messaggio", nome: "Messaggio", tinta: "bg-tipo-messaggio-soft text-tipo-messaggio" },
  meet: { icona: Handshake, azione: "ha fatto un incontro", nome: "Incontro", tinta: "bg-tipo-incontro-soft text-tipo-incontro" },
  fase: { icona: MoveRight, azione: "ha spostato la trattativa in", nome: "Spostata in", tinta: "text-mute-deco" },
};

export const diPersona = (a: Pick<Attivita, "creato_da">) => Boolean(a.creato_da?.includes("@"));

export const ESITI: Record<string, { nome: string; tono: TonoChip }> = {
  risposto: { nome: "Ha risposto", tono: "blu" },
  "ha-risposto": { nome: "Ha risposto", tono: "blu" },
  "non-risponde": { nome: "Non risponde", tono: "neutro" },
  richiamare: { nome: "Da richiamare", tono: "ambra" },
  "numero-errato": { nome: "Numero errato", tono: "rosso" },
  inviato: { nome: "Inviato", tono: "neutro" },
  fatta: { nome: "Fatta", tono: "verde" },
  "non-presentato": { nome: "Non presentato", tono: "rosso" },
  spostata: { nome: "Spostata", tono: "ambra" },
  "da-chiamare": { nome: "Da chiamare", tono: "vuoto" },
  interessato: { nome: "Interessato", tono: "verde" },
  "non-interessato": { nome: "Non interessato", tono: "rosso" },
};

export const ESITI_CHIAMATA: { esito: string; esito_azienda?: string; nome: string; su: "azienda" | "altro" | "sempre" }[] = [
  { esito: "risposto", nome: "Ha risposto", su: "altro" },
  { esito: "non-risponde", esito_azienda: "non-risponde", nome: "Non risponde", su: "sempre" },
  { esito: "richiamare", esito_azienda: "richiamare", nome: "Da richiamare", su: "sempre" },
  { esito: "risposto", esito_azienda: "interessato", nome: "Interessato", su: "azienda" },
  { esito: "risposto", esito_azienda: "non-interessato", nome: "Non interessato", su: "azienda" },
  { esito: "numero-errato", nome: "Numero errato", su: "sempre" },
];

export const suAzienda = (l: Legami) => Boolean(l.azienda_id) && !l.trattativa_id;
