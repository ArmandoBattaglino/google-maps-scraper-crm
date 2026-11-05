import { ESITI } from "@/crm/aziende/campi";
import { VOCI as VOCI_CANALE } from "@/crm/origini/voci";
import { MOTIVI_PERSO, TEMPERATURE } from "@/crm/trattative/tipi";
import type { Risorsa } from "./stato";

export interface Opzione {
  valore: string;
  etichetta: string;
}

const NOMI: Record<string, string> = {
  nome: "Nome",
  comune: "Comune",
  categoria: "Categoria",
  categorie: "Categorie",
  telefono: "Telefono",
  sito: "Sito",
  email: "Email",
  piva: "P. IVA",
  indirizzo: "Indirizzo",
  referente: "Referente",
  esito: "Esito",
  etichetta: "Etichetta",
  stato: "Stato",
  richiamare_il: "Richiamare il",
  ultima_chiamata: "Ultima chiamata",
  chiamato_da: "Chiamata da",
  tentativi: "Tentativi",
  valutazione: "Valutazione",
  recensioni: "Recensioni",
  ultima_nota: "Ultima nota",
  da_dove: "Da dove",
  canale: "Canale",
  aggiornato: "Aggiornato",
  creato: "Creato",
  creato_da: "Creato da",
  lat: "Latitudine",
  lng: "Longitudine",
  unione: "Unione",
  unione_motivo: "Motivo dell'unione",
  ruolo: "Posizione",
  fonte: "Fonte",
  origine: "Origine",
  archiviata_il: "Archiviata il",
  percorso: "Percorso",
  fase_id: "Fase della bacheca",
  avvio: "Avvio",
  canone: "Canone",
  valore: "Valore",
  prossimo_passo: "Prossimo passo",
  prossimo_il: "Prossimo il",
  segue: "Segue",
  mossa_il: "Ultima mossa",
  temperatura: "Temperatura",
  motivo_perso: "Motivo perso",
  tipo: "Tipo",
  testo: "Testo",
  scadenza: "Scadenza",
  fatto_il: "Fatto il",
  durata: "Durata",
  quando: "Quando",
  fase: "Fase",
  "azienda.nome": "Azienda",
  "azienda.comune": "Comune",
  "azienda.categoria": "Categoria dell'azienda",
  "azienda.esito": "Esito dell'azienda",
  "azienda.telefono": "Telefono dell'azienda",
  "persona.nome": "Persona",
  "persona.ruolo": "Posizione della persona",
  "persona.telefono": "Telefono della persona",
  "persona.email": "Email della persona",
  "fase.nome": "Fase",
  "fase.tipo": "Tipo di fase",
  "fase.ordine": "Ordine della fase",
  "scheda.segue": "Segue",
  "trattativa.fase_id": "Fase della trattativa",
  "trattativa.segue": "Trattativa seguita da",
  "trattativa.prossimo_passo": "Passo della trattativa",
};

const NOMI_DI: Partial<Record<Risorsa, Record<string, string>>> = {
  trattative: { note: "Note" },
  aziende: { note: "Note sull'azienda" },
};

const NASCOSTI = new Set(["id", "place_id", "telefono_norm", "dominio", "contatto_id", "attivita_app_id", "ponte_il", "registrazione", "origine"]);

const PUBBLICITA = new Set(["campagna", "inserzione", "gruppo", "gruppo_inserzioni", "piattaforma", "creativita", "creativita_id", "meta_ad_id", "meta_lead_id"]);

export const nascosto = (campo: string): boolean => NASCOSTI.has(campo) || PUBBLICITA.has(campo.slice(campo.lastIndexOf(".") + 1));

export const nomeColonna = (campo: string, risorsa?: Risorsa): string => (risorsa && NOMI_DI[risorsa]?.[campo]) || NOMI[campo] || campo.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());

export const OPERATORE: Record<string, string> = {
  uguale: "=",
  diverso: "≠",
  in: "è uno di",
  non_in: "non è uno di",
  contiene: "contiene",
  inizia: "inizia con",
  vuoto: "è vuoto",
  non_vuoto: "non è vuoto",
  maggiore: ">",
  minore: "<",
  tra: "fra",
  negli_ultimi_giorni: "negli ultimi giorni",
  entro_giorni: "entro i prossimi giorni",
  tutte: "tutte",
};
const OPERATORE_TEMPO: Record<string, string> = { maggiore: "dopo il", minore: "prima del", uguale: "il", diverso: "non il" };

export const nomeOperatore = (op: string, tipo?: string): string =>
  ((tipo === "data" || tipo === "istante") && OPERATORE_TEMPO[op]) || OPERATORE[op] || op;

const coppie = (l: string[][]): Opzione[] => l.map(([valore, etichetta]) => ({ valore, etichetta }));
const ESITI_AZIENDA: Opzione[] = ESITI.map((e) => ({ valore: e.id, etichetta: e.name }));
const TIPI_ATTIVITA = coppie([
  ["chiamata", "Chiamata"],
  ["nota", "Nota"],
  ["email", "Email"],
  ["compito", "Compito"],
  ["whatsapp", "WhatsApp"],
  ["messaggio", "Messaggio"],
  ["meet", "Incontro"],
  ["fase", "Cambio di fase"],
]);
const ESITI_ATTIVITA = coppie([
  ["risposto", "Risposto"],
  ["non-risponde", "Non risponde"],
  ["richiamare", "Da richiamare"],
  ["numero-errato", "Numero errato"],
  ["inviato", "Inviato"],
  ["ha-risposto", "Ha risposto"],
  ["fatta", "Fatta"],
  ["non-presentato", "Non presentato"],
  ["spostata", "Spostata"],
]);
const ETICHETTE = coppie([
  ["pertinente", "Pertinente"],
  ["non-azienda", "Non è un'azienda"],
]);
const TIPI_FASE = coppie([
  ["aperta", "Aperta"],
  ["cliente", "Cliente"],
  ["perso", "Perso"],
]);

export const opzioniFisse = (risorsa: Risorsa, campo: string): Opzione[] | null => {
  if (campo === "azienda.esito") return ESITI_AZIENDA;
  if (campo === "canale") return VOCI_CANALE.map((v) => ({ valore: v.etichetta, etichetta: v.etichetta }));
  if (campo === "fase.tipo") return TIPI_FASE;
  if (campo === "etichetta" && risorsa === "aziende") return ETICHETTE;
  if (campo === "temperatura") return TEMPERATURE;
  if (campo === "motivo_perso") return MOTIVI_PERSO;
  if (campo === "esito") return risorsa === "aziende" ? ESITI_AZIENDA : ESITI_ATTIVITA;
  if (campo === "tipo" && risorsa === "attivita") return TIPI_ATTIVITA;
  return null;
};
