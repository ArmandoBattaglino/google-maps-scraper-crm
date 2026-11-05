export type Segnaposto = "nome" | "azienda" | "utente";
export type Valori = Record<Segnaposto, string>;

const TROVA = /\{(nome|azienda|utente|socio)\}/g;

export const riempi = (bozza: string, valori: Valori) => {
  const mancanti = new Set<Segnaposto>();
  const testo = bozza.replace(TROVA, (pezzo, trovato: Segnaposto | "socio") => {
    const chiave = trovato === "socio" ? "utente" : trovato;
    const valore = valori[chiave].trim();
    if (!valore) mancanti.add(chiave);
    return valore || pezzo;
  });
  return { testo, mancanti: [...mancanti] };
};

const SPAIATO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export const linkWa = (numero: string, testo: string) => {
  const base = `https://wa.me/${numero}`;
  return testo ? `${base}?text=${encodeURIComponent(testo.replace(SPAIATO, "�"))}` : base;
};

export const normaTelefono = (telefono: string) => {
  const x = telefono.replace(/\D/g, "");
  if (x.length < 6) return "";
  if (x.startsWith("0039")) return x.slice(2);
  if (x.startsWith("39") && x.length >= 11) return x;
  return `39${x}`;
};

export const numeroDi = (riga?: { telefono?: string; telefono_norm?: string }) =>
  riga?.telefono_norm || normaTelefono(riga?.telefono ?? "");
