import { senzaContatti } from "./riservato.mjs";

export async function segnala(err, extra = {}) {
  const dove = [extra.percorso, extra.metodo, extra.come].filter(Boolean).join(" ");
  console.error(`errore${dove ? ` (${dove})` : ""}: ${senzaContatti(String(err?.stack || err)).slice(0, 2000)}`);
}
