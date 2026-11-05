import { ErroreApi } from "./regole.mjs";

const LETTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const SCRITTURA = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

export const STRUMENTI_RACCOLTE = Object.freeze([
  { name: "raccolta_liste", title: "Raccolte: le liste a freddo",
    description: "Le liste a freddo coi conti: quante aziende, quante col telefono, quante con l'email, quante da chiamare. Per scegliere in quale lista mettere una raccolta (lista = id).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: LETTURA },
  { name: "raccolta_avvia", title: "Raccolte: cerca aziende su Google Maps",
    description: "Con «zona» (una provincia, un comune intero) fa la GRIGLIA: copre tutta la zona a celle, cerca una dopo l'altra le parole date e scrive il rapporto di copertura (raccolta_stato). Con «dove» cerca per nome di luogo. Non si butta niente: fermate, stazioni, parcheggi e colonnine restano salvate ma con l'etichetta «non-azienda», fuori dai conti e dalle chiamate. Ogni azienda sa quali ricerche l'hanno trovata (raccolta_stato → campione → trovata_da). Riempie una lista a freddo da solo: il motore apre Google Maps (Chrome, senza login né servizi a pagamento), cerca «cosa» in ogni luogo di «dove», legge nome, telefono, sito, indirizzo, categoria, voto e recensioni, e le mette nella lista (la stessa azienda non entra due volte). poi_siti = true: dopo, legge i siti delle aziende trovate per email, PEC e P.IVA. Torna SUBITO col numero; gira da sola, una raccolta alla volta. Maps mostra ~120 posti per ricerca: per averne di più, più luoghi (quartieri, paesi vicini). tipo «siti» = solo la lettura dei siti di una lista che c'è già.",
    inputSchema: { type: "object", additionalProperties: false, properties: {
      tipo: { type: "string", enum: ["google-maps", "siti"], default: "google-maps" },
      cosa: { type: "string", minLength: 2, maxLength: 120, description: "Cosa cercare su Maps, come lo scriverebbe una persona: «autotrasporti», «officine meccaniche», «studi dentistici»." },
      dove: { type: "array", minItems: 1, maxItems: 30, items: { type: "string", minLength: 1, maxLength: 80 }, description: "I luoghi: città, quartieri, paesi (es. [\"Genova\", \"Savona\", \"Chiavari\"])." },
      massimo: { type: "integer", minimum: 1, maximum: 1000, description: "google-maps: aziende per luogo (1-200, di base 60) · siti: quanti siti leggere (di base 300)." },
      poi_siti: { type: "boolean", default: false, description: "Dopo Maps, leggi i siti delle aziende trovate (email, PEC, P.IVA)." },
      zona: { type: "string", maxLength: 120, description: "La GRIGLIA: una zona intera da coprire tutta, al posto di «dove». Un comune («Brescia»), una provincia («provincia di Brescia» o «BS»), una città metropolitana («città metropolitana di Roma»); un nome doppio con la sigla («Castro (LE)»). Il motore divide la zona in celle finché ognuna è completa, tiene solo le aziende DENTRO i confini ISTAT e scrive il rapporto di copertura." },
      parole: { type: "array", minItems: 1, maxItems: 6, items: { type: "string", minLength: 2, maxLength: 120 }, description: "Con zona: da 1 a 6 parole, cercate tutte, una dopo l'altra, es. [\"dentista\", \"studio dentistico\", \"odontoiatra\"]. La parola conta più del metodo: al singolare e come la scrive un cliente («dentista» trova molto più di «dentisti»). Con campione = true il motore aggiunge le categorie di Maps che ricorrono intorno al capoluogo, se portano aziende nuove." },
      solo_nicchia: { type: "boolean", default: false, description: "Con zona: false (di base) = prende TUTTO quello che Maps dà per la ricerca e segna in_nicchia/dubbio; true = una pagina intera senza aziende della nicchia chiude la cella (più veloce, meno aziende fuori tema)." },
      campione: { type: "boolean", default: false, description: "Con zona: aggiungi alle tue parole quelle dalle categorie di Maps del campione (a saturazione: una che porta meno del 5% di nuovi non si lancia). Di base no; con solo_nicchia sì, la nicchia nasce lì." },
      tetto: { type: "integer", enum: [160, 100, 60], default: 160, description: "Con zona: posti per cella prima di dividerla (la prova del figlio lo abbassa da sola se serve)." },
      fonte: { type: "string", default: "zoom", description: "Con zona, il metodo: zoom (di base) = il JSON interno di Maps SENZA il nome del luogo, col centro e lo zoom della cella · ibrida = lo stesso JSON cercando «parola Comune»." },
      strada: { type: "string", enum: ["ibrida", "browser"], default: "ibrida", description: "ibrida (di base): il JSON interno di Maps con fetch nel browser, più veloce e con più campi; se non va, quel luogo lo fa il browser. browser: solo la pagina disegnata." },
      lista: { type: "string", description: "L'id di una lista che c'è già (da raccolta_liste). Obbligatorio per tipo «siti»." },
      nuova_lista: { type: "string", maxLength: 120, description: "Il nome di una lista nuova. Senza lista né nuova_lista: «Cosa · Luogo»." } } }, annotations: SCRITTURA },
  { name: "raccolta_stato", title: "Raccolte: com'è andata",
    description: "Una raccolta: stato (in-corso, finita, fermata, errore, interrotta), dove è arrivata, trovate / nuove / aggiornate, l'errore con le parole vere, e un campione delle aziende portate. Senza raccolta: le ultime 10.",
    inputSchema: { type: "object", additionalProperties: false, properties: { raccolta: { type: "string", minLength: 1, maxLength: 40, description: "Il numero (es. \"3\") o l'id della raccolta." } } }, annotations: LETTURA },
  { name: "raccolta_ferma", title: "Raccolte: ferma",
    description: "Ferma una raccolta in corso dopo il passo che sta facendo: le aziende già lette restano nella lista.",
    inputSchema: { type: "object", additionalProperties: false, required: ["raccolta"], properties: { raccolta: { type: "string", minLength: 1, maxLength: 40 } } }, annotations: SCRITTURA },
  { name: "raccolta_riprendi", title: "Raccolte: rifai",
    description: "Interrotta, fermata o in errore: la RIPRENDE (la stessa raccolta, dalla cella dov'era: le celle già complete non si richiedono). Finita: la RIFÀ (una raccolta nuova con gli stessi parametri; le aziende già nell'anagrafica non si doppiano). Dopo un captcha la raccolta è «interrotta» con riprende_alle e riparte da sola.",
    inputSchema: { type: "object", additionalProperties: false, required: ["raccolta"], properties: { raccolta: { type: "string", minLength: 1, maxLength: 40 } } }, annotations: SCRITTURA },
]);

export function creaRaccolteMcp({ url }) {
  const base = String(url).replace(/\/+$/, "");
  const fuori = (x) => x;
  async function json(email, metodo, percorso, corpo, attesa = 30_000) {
    let r;
    try {
      r = await fetch(base + percorso, { method: metodo, signal: AbortSignal.timeout(attesa),
        headers: { "x-utente-email": email, "x-utente-da": "mcp", ...(corpo === undefined ? {} : { "content-type": "application/json" }) },
        body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    } catch { throw new ErroreApi(503, "il raccoglitore non risponde"); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ErroreApi(r.status, j.errore || `il raccoglitore ha risposto ${r.status}`);
    return j;
  }
  return {
    async raccolta_liste(email) {
      const l = await json(email, "GET", "/api/raccolte/liste");
      return fuori({ quante: l.length, liste: l, nota: l.length ? "lista = id, in raccolta_avvia" : "nessuna lista: raccolta_avvia ne crea una (nuova_lista)" });
    },
    async raccolta_avvia(email, a) {
      const j = await json(email, "POST", "/api/raccolte", { tipo: a.tipo, cosa: a.cosa, dove: a.dove, massimo: a.massimo, poi_siti: a.poi_siti, strada: a.strada, lista: a.lista, nuova_lista: a.nuova_lista,
        zona: a.zona, parole: a.parole, campione: a.campione, solo_nicchia: a.solo_nicchia, tetto: a.tetto, fonte: a.fonte }, 60_000);
      return fuori({ raccolta: j.numero, id: j.id, tipo: j.tipo, lista: j.lista, parametri: j.parametri, stato: j.stato,
        nota: `la raccolta #${j.numero} gira da sola (una alla volta): segui con raccolta_stato {raccolta: "${j.numero}"}; lista «${j.lista?.nome}»` });
    },
    async raccolta_stato(email, a) {
      const corta = (r) => ({ raccolta: r.numero, tipo: r.tipo, stato: r.stato, passo: r.passo || undefined, trovate: r.trovate, nuove: r.nuove, aggiornate: r.aggiornate,
        parametri: r.parametri, creato_da: r.creato_da, creato: r.creato, ...(r.finita ? { finita: r.finita } : {}), ...(r.rapporto && Object.keys(r.rapporto).length ? { rapporto: r.rapporto } : {}), ...(r.errore ? { errore: r.errore } : {}), ...(r.fermata_da ? { fermata_da: r.fermata_da } : {}) });
      if (a.raccolta === undefined) return fuori({ raccolte: (await json(email, "GET", "/api/raccolte?limite=10")).map(corta) });
      const d = await json(email, "GET", `/api/raccolte/${encodeURIComponent(String(a.raccolta))}`);
      return fuori({ ...corta(d), lista: d.lista, campione: d.campione, non_aziende: d.non_aziende });
    },
    async raccolta_ferma(email, a) {
      const r = await json(email, "POST", `/api/raccolte/${encodeURIComponent(String(a.raccolta))}/ferma`, {});
      return fuori({ raccolta: r.numero, stato: r.stato, passo: r.passo, nota: r.stato === "in-corso" ? "si ferma dopo il passo in corso: le aziende già lette restano" : `era già «${r.stato}»` });
    },
    async raccolta_riprendi(email, a) {
      const r = await json(email, "POST", `/api/raccolte/${encodeURIComponent(String(a.raccolta))}/riprendi`, {});
      return fuori({ raccolta: r.numero, id: r.id, stato: r.stato, nota: `rifatta come #${r.numero}: raccolta_stato {raccolta: "${r.numero}"}` });
    },
  };
}
