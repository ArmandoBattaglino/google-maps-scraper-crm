export const CAMPI_SCRIVIBILI = ["nome", "ruolo", "telefono", "email", "azienda_id"] as const;

export interface Persona {
  aggiornato?: string;
  id: string;
  azienda_id: string | null;
  nome: string;
  ruolo: string;
  telefono: string;
  email: string;
  fonte: string;
  origine: "crm" | "app";
  archiviata_il: string | null;
  creato: string;
  creato_da: string | null;
}

export const NON_ARCHIVIATE = { "archiviata_il@is": "null" };

type Dati = Record<string, unknown>;

export const soloScrivibili = (dati: Dati): Dati => {
  const fuori: Dati = {};
  for (const campo of CAMPI_SCRIVIBILI) {
    if (!(campo in dati)) continue;
    const valore = dati[campo];
    if (campo === "azienda_id") fuori[campo] = valore || null;
    else fuori[campo] = typeof valore === "string" ? valore.trim() : "";
  }
  return fuori;
};

export const nomeNonVuoto = (valore: unknown) =>
  typeof valore === "string" && valore.trim() ? undefined : "ra.validation.required";

export const hrefTelefono = (telefono: string) => {
  const numero = telefono.replace(/[^+\d]/g, "");
  return numero ? `tel:${numero}` : undefined;
};

export const hrefEmail = (email: string) =>
  /^[^\s@?&]+@[^\s@?&]+$/.test(email.trim()) ? `mailto:${email.trim()}` : undefined;

export const pathAzienda = (id: string) => `/aziende/${id}`;
export const pathPersona = (id: string) => `/persone/${id}`;
export const pathModificaPersona = (id: string) => `/persone/${id}/modifica`;
export const pathNuovaPersona = (aziendaId: string) => `/persone/create?azienda_id=${encodeURIComponent(aziendaId)}`;
