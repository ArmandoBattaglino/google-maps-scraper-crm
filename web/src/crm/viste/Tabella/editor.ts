import { CAMPI_SCRIVIBILI } from "@/crm/aziende/campi";
import type { Contesto } from "../contesto";
import type { RigaVista } from "../dati";
import type { Opzione } from "../etichette";
import type { Risorsa } from "../stato";

export type TipoEditor = "testo" | "numero" | "data" | "istante" | "scelta" | "multi" | "booleano" | "legame" | "valore";

export interface Editore {
  tipo: TipoEditor;
  opzioni: Opzione[];
  svuotabile: boolean;
  fra?: "aziende" | "persone";
  lungo?: boolean;
}

const DEL_LEGAME: Record<string, { risorsa: "aziende" | "persone" | "trattative"; chiave: string; colonne: Set<string> }> = {
  azienda: { risorsa: "aziende", chiave: "azienda_id", colonne: new Set(["comune", "categoria", "telefono"]) },
  persona: { risorsa: "persone", chiave: "persona_id", colonne: new Set(["ruolo", "telefono", "email"]) },
  trattativa: { risorsa: "trattative", chiave: "trattativa_id", colonne: new Set(["prossimo_passo"]) },
};

const COLLEGA: Record<string, { fra: "aziende" | "persone"; chiave: string }> = {
  "azienda.nome": { fra: "aziende", chiave: "azienda_id" },
  "persona.nome": { fra: "persone", chiave: "persona_id" },
};

const CALCOLATI = new Set(["tentativi", "ultima_chiamata", "chiamato_da", "richiamare_il", "scheda.segue"]);
const segueSu = (riga: RigaVista) => riga.segue_su as { trattativa_id: string; altre_aperte?: number } | null | undefined;
export const calcolatoQui = (risorsa: Risorsa, riga: RigaVista, campo: string) =>
  risorsa === "aziende" && CALCOLATI.has(campo) && riga.ha_trattative === true && !(campo === "scheda.segue" && segueSu(riga));

export const eFase = (campo: string) => campo === "fase.nome" || campo === "fase_id";

export const destinoDi = (risorsa: Risorsa, riga: RigaVista, campo: string, valore: unknown): { risorsa: Risorsa; id: string; data: Record<string, unknown> } | null => {
  if (COLLEGA[campo]) return { risorsa, id: riga.id, data: { [COLLEGA[campo].chiave]: valore === "" ? null : valore } };
  const viva = risorsa === "aziende" && campo === "scheda.segue" ? segueSu(riga) : null;
  if (viva) return { risorsa: "trattative", id: viva.trattativa_id, data: { segue: valore === "" || valore === undefined ? null : valore } };
  if (campo === "valore" && risorsa === "trattative") return { risorsa, id: riga.id, data: valore as Record<string, unknown> };
  const punto = campo.indexOf(".");
  const legame = punto > 0 ? DEL_LEGAME[campo.slice(0, punto)] : undefined;
  if (legame) {
    const id = riga[legame.chiave];
    if (typeof id !== "string" || !id) return null;
    const v = valore === null || valore === undefined ? "" : valore;
    return { risorsa: legame.risorsa, id, data: { [campo.slice(punto + 1)]: v } };
  }
  return { risorsa, id: riga.id, data: corpoPatch(risorsa, riga, campo, valore) };
};

const SCRIVIBILI: Record<Risorsa, Set<string>> = {
  aziende: new Set([...CAMPI_SCRIVIBILI, "scheda.segue"]),
  persone: new Set(["nome", "ruolo", "telefono", "email", "fonte"]),
  trattative: new Set(["avvio", "canone", "percorso", "prossimo_passo", "prossimo_il", "segue", "temperatura", "motivo_perso", "note"]),
  attivita: new Set(["testo", "scadenza", "esito"]),
};
const OBBLIGATORI = new Set(["nome"]);
export const DEL_TIPO: Record<string, TipoEditor> = { testo: "testo", link: "testo", telefono: "testo", email: "testo", numero: "numero", valuta: "numero", data: "data", scelta: "scelta", multi: "multi", booleano: "booleano" };

export const editoreDi = (ctx: Contesto, campo: string): Editore | null => {
  const voce = ctx.voce(campo);
  if (!voce) return null;
  const opzioni = ctx.opzioniDi(campo) ?? [];
  if (COLLEGA[campo] && ctx.risorsa !== "aziende") return { tipo: "legame", opzioni: [], svuotabile: true, fra: COLLEGA[campo].fra };
  if (ctx.risorsa === "trattative" && eFase(campo)) return { tipo: "scelta", opzioni, svuotabile: false };
  if (ctx.risorsa === "trattative" && campo === "valore") return { tipo: "valore", opzioni: [], svuotabile: false };
  const punto = campo.indexOf(".");
  const legame = punto > 0 ? DEL_LEGAME[campo.slice(0, punto)] : undefined;
  if (legame?.colonne.has(campo.slice(punto + 1))) return { tipo: "testo", opzioni: [], svuotabile: true };
  if (voce.personalizzato) {
    const tipo = DEL_TIPO[voce.tipo_campo ?? ""];
    return tipo ? { tipo, opzioni, svuotabile: true } : null;
  }
  if (!SCRIVIBILI[ctx.risorsa].has(campo)) return null;
  const svuotabile = !OBBLIGATORI.has(campo) && !(campo === "esito" && ctx.risorsa === "aziende");
  if (opzioni.length) return { tipo: "scelta", opzioni, svuotabile };
  if (voce.tipo === "istante") return { tipo: "istante", opzioni, svuotabile };
  if (voce.tipo === "data") return { tipo: "data", opzioni, svuotabile };
  if (voce.tipo === "numero") return { tipo: "numero", opzioni, svuotabile };
  if (voce.tipo === "booleano") return { tipo: "booleano", opzioni, svuotabile };
  if (voce.tipo === "testo") return { tipo: "testo", opzioni, svuotabile, lungo: campo === "note" };
  return null;
};

const NON_NULL: Record<Risorsa, Set<string>> = {
  aziende: new Set([...CAMPI_SCRIVIBILI].filter((c) => c !== "richiamare_il")),
  persone: new Set(["nome", "ruolo", "telefono", "email", "fonte"]),
  trattative: new Set(["prossimo_passo", "note"]),
  attivita: new Set(["testo"]),
};

export const corpoPatch = (risorsa: Risorsa, riga: RigaVista, campo: string, valore: unknown): Record<string, unknown> => {
  if (campo.startsWith("campi.")) {
    const chiave = campo.slice(6);
    const vuoto = valore === "" || valore === undefined ? null : valore;
    if (risorsa === "aziende") return { campi: { [chiave]: vuoto } };
    return { campi: { ...(riga.campi as Record<string, unknown> | undefined), [chiave]: vuoto } };
  }
  const nome = campo === "scheda.segue" ? "segue" : campo;
  const vuoto = valore === "" || valore === undefined || valore === null;
  if (vuoto) return { [nome]: NON_NULL[risorsa].has(campo) ? "" : null };
  return { [nome]: valore };
};
