import { daSocio, leggiUna } from "./aziende.mjs";
import { ESITI } from "./coda.mjs";
import { traduciErrorePg } from "./dati.mjs";
import { SOCIO_SQL } from "./db.mjs";
import { ErroreApi } from "./regole.mjs";
import { senzaContatti } from "./riservato.mjs";
import { STRUMENTI_RACCOLTE, creaRaccolteMcp } from "./raccolte-mcp.mjs";
import { legamiStatoPersona, statoPersona, statoTesto } from "./stato.mjs";

export const VERSIONI = Object.freeze(["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]);
const LIMITE_CORPO = 1024 * 1024;
export const LIMITE_RISPOSTA = 400_000;
const TIMELINE = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GIORNO = /^\d{4}-\d{2}-\d{2}$/;
const CON_FUSO = /(Z|[+-]\d{2}:?\d{2})$/i;
const COLONNA = /^[a-z_][a-z0-9_]{0,80}$/;
const CHIAVE_CAMPO = /^[a-z][a-z0-9_]{0,39}$/;
const NON_SOCIO = "Questa email non è fra gli utenti del CRM: nessuna riga.";

const ID = { type: "string", format: "uuid", description: "L'id (uuid) che torna da crm_cerca, crm_vista o crm_crea." };
const LETTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const SCRITTURA = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const STRUMENTI = Object.freeze([
  { name: "crm_cerca", title: "CRM: cerca",
    description: "Cerca un testo nelle aziende, nelle persone e nelle trattative del CRM: per ognuna id, tipo, nome, in quali campi combacia e, per aziende e persone, lo stato (la fase della trattativa; senza trattative, l'esito delle chiamate a freddo). Per la scheda intera: crm_scheda con l'id.",
    inputSchema: { type: "object", additionalProperties: false, required: ["testo"], properties: {
      testo: { type: "string", minLength: 2, maxLength: 200, description: "Il testo da cercare (almeno 2 caratteri): un nome, un telefono, un sito, una città." },
      tipi: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", enum: ["aziende", "persone", "trattative"] }, description: "Dove cercare (di base tutti e tre)." },
      limite: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Risultati al massimo per tipo (1-50, di base 10)." },
    } }, annotations: LETTURA },
  { name: "crm_scheda", title: "CRM: la scheda",
    description: "La scheda di un'azienda, di una persona o di una trattativa: i campi (anche quelli personalizzati), lo stato, i legami (persone dell'azienda, trattative) e la timeline delle attività, dalla più recente. ⚠️ Per sapere a che punto è un'azienda si guarda «stato»: «esito» è solo quello delle chiamate a freddo. Con almeno una trattativa, anche archiviata, tentativi, ultima chiamata, segue e prossimo sono calcolati dalle trattative e dalle attività.",
    inputSchema: { type: "object", additionalProperties: false, required: ["tipo", "id"], properties: {
      tipo: { type: "string", enum: ["azienda", "persona", "trattativa"], description: "Azienda, persona o trattativa." },
      id: ID,
    } }, annotations: LETTURA },
  { name: "crm_vista", title: "CRM: una vista",
    description: "Le righe (o i gruppi) di una vista salvata del CRM («fammi le trattative ferme» = vista «Ferme da 7 giorni»), oppure di un albero di filtri: gli stessi id che il utente vede in /crm.",
    inputSchema: { type: "object", additionalProperties: false, properties: {
      vista: { type: "string", minLength: 1, maxLength: 120, description: "Una vista salvata, per nome («Ferme da 7 giorni») o per id." },
      risorsa: { type: "string", enum: ["trattative", "aziende", "persone"], default: "trattative", description: "Con i filtri: su cosa (di base trattative)." },
      filtri: { type: "object", description: "Al posto della vista: l'albero dei filtri {e:[…]} o {o:[…]}, ogni condizione {campo, op, valore}. op: uguale, diverso, in, non_in, contiene, inizia, vuoto, non_vuoto, maggiore, minore, tra, negli_ultimi_giorni, entro_giorni. Le aziende: le non-aziende delle raccolte (fermate, parcheggi) sono nascoste, si rivedono con {campo: \"etichetta\", op: \"tutte\"}." },
      raggruppa_per: { type: "array", minItems: 1, maxItems: 2, items: { type: "string", pattern: "^[a-z_][a-z0-9_.]{0,80}$" }, description: "Fino a 2 campi: torna i gruppi con i conteggi e i totali, non le righe." },
      limite: { type: "integer", minimum: 1, maximum: 200, default: 50, description: "Righe per pagina (1-200, di base 50)." },
      salta: { type: "integer", minimum: 0, maximum: 1_000_000, default: 0, description: "Quante righe saltare (la pagina)." },
    } }, annotations: LETTURA },
  { name: "crm_crea", title: "CRM: crea un'azienda, una persona o una trattativa",
    description: "Crea una riga nel CRM a nome di chi chiede (creato_da = la sua email). Un'azienda passa dal controllo dei doppioni: se c'è già (stessa P.IVA, telefono, sito, scheda di Maps) torna quella con nuova: false, nessuna riga nuova. Non cancella niente.",
    inputSchema: { type: "object", additionalProperties: false, required: ["tipo", "valori"], properties: {
      tipo: { type: "string", enum: ["azienda", "persona", "trattativa"], description: "Cosa creare." },
      valori: { type: "object", description: "I campi. Azienda {nome, telefono?, sito?, piva?, email?, comune?} · persona {nome, email?, telefono?, ruolo?, azienda_id?} · trattativa {nome?, azienda_id?, persona_id?, fase?, percorso?, avvio?, canone?, prossimo_passo?} · i campi personalizzati come «campi.<chiave>». Una trattativa non ha un nome suo: «nome» va in testa alle note." },
    } }, annotations: SCRITTURA },
  { name: "crm_attivita", title: "CRM: una nota, una chiamata, un compito",
    description: "Aggiunge un'attività alla timeline di una trattativa, di un'azienda o di una persona (almeno uno dei tre id): una nota, una chiamata con l'esito, un compito con la scadenza. A nome di chi chiede. Una chiamata su un'azienda senza trattativa aggiorna l'esito dell'azienda. Non cancella niente.",
    inputSchema: { type: "object", additionalProperties: false, required: ["tipo", "testo"], properties: {
      tipo: { type: "string", enum: ["nota", "chiamata", "compito"], description: "Nota, chiamata o compito." },
      trattativa_id: ID, azienda_id: ID, persona_id: ID,
      testo: { type: "string", minLength: 1, maxLength: 4000, description: "La nota, il riassunto della chiamata o cosa c'è da fare." },
      esito: { type: "string", enum: ["non-risponde", "occupato", "richiamare", "non-interessato", "interessato"], description: "Solo per una chiamata. «occupato» si salva come non-risponde." },
      quando: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}([T ]\\d{2}:\\d{2}(:\\d{2})?(Z|[+-]\\d{2}:?\\d{2})?)?$", description: "Compito: la scadenza · chiamata «richiamare»: quando. ISO, senza fuso è l'ora di Roma (2026-11-05T10:00)." },
      assegnato_a: { type: "string", format: "email", maxLength: 320, description: "Compito: l'email dell'utente che lo deve fare. Senza, è di chi lo crea." },
    } }, annotations: SCRITTURA },
]);
const TUTTI = Object.freeze([...STRUMENTI, ...STRUMENTI_RACCOLTE]);
const PER_NOME = new Map(TUTTI.map((s) => [s.name, s]));

const ISTRUZIONI = "Il CRM, con le regole del sito: vedi quello che vede il tuo utente. crm_cerca per trovare, crm_scheda per leggere, crm_vista per le viste " +
  "salvate e gli alberi di filtri: in lettura. crm_crea e crm_attivita scrivono a tuo nome. raccolta_avvia cerca aziende su Google Maps e le mette in una lista; " +
  "raccolta_stato dice a che punto è. Nessuno strumento cancella. Le date senza fuso sono l'ora di Roma.";

class ErroreMcp extends Error {
  constructor(codice, message) { super(message); this.codice = codice; }
}
const male = (messaggio, code = "valore") => new ErroreApi(400, messaggio, code);

function controlla(s, v, nome) {
  if (s.type === "string") {
    if (typeof v !== "string" || v.includes("\0")) throw male(`${nome}: serve un testo`);
    if (s.minLength !== undefined && v.length < s.minLength) throw male(`${nome}: almeno ${s.minLength} caratteri`);
    if (s.maxLength !== undefined && v.length > s.maxLength) throw male(`${nome}: al massimo ${s.maxLength} caratteri`);
    if (s.enum && !s.enum.includes(v)) throw male(`${nome}: fuori lista, ci sono ${s.enum.join(", ")}`);
    if (s.pattern && !new RegExp(s.pattern).test(v)) throw male(`${nome}: formato non valido`);
    if (s.format === "uuid" && !UUID.test(v)) throw male(`${nome}: serve un id (uuid)`);
    if (s.format === "email" && !/^[^@\s]+@[^@\s]+$/.test(v)) throw male(`${nome}: serve un'email`);
  } else if (s.type === "boolean") {
    if (typeof v !== "boolean") throw male(`${nome}: serve vero o falso`);
  } else if (s.type === "integer") {
    if (!Number.isInteger(v) || v < s.minimum || v > s.maximum) throw male(`${nome}: serve un intero nei limiti`);
    if (s.enum && !s.enum.includes(v)) throw male(`${nome}: fuori lista, ci sono ${s.enum.join(", ")}`);
  } else if (s.type === "array") {
    if (!Array.isArray(v) || v.length < s.minItems || v.length > s.maxItems) throw male(`${nome}: serve un elenco di ${s.minItems}-${s.maxItems} voci`);
    v.forEach((x) => controlla(s.items, x, nome));
  } else if (s.type === "object") {
    if (v === null || typeof v !== "object" || Array.isArray(v)) throw male(`${nome}: serve un oggetto`);
  }
}

const CERCA = Object.freeze({
  aziende: { tipo: "azienda", dove: ["nome", "telefono", "sito", "email", "comune", "piva"], norma: true, vive: false,
    colonne: ["nome", "telefono", "telefono_norm", "sito", "email", "comune", "piva", "stato"], ordine: [{ campo: "nome", dir: "asc" }],
    mostra: (r) => ({ nome: r.nome, comune: r.comune, stato: r.stato, stato_segni: r.stato_segni }) },
  persone: { tipo: "persona", dove: ["nome", "email", "telefono", "ruolo", "azienda.nome"], norma: true, vive: true,
    colonne: ["nome", "email", "telefono", "telefono_norm", "ruolo", "azienda_id", "azienda.nome", "stato"], ordine: [{ campo: "nome", dir: "asc" }],
    mostra: (r) => ({ nome: r.nome, ruolo: r.ruolo, azienda: r["azienda.nome"], azienda_id: r.azienda_id, stato: r.stato, stato_segni: r.stato_segni }) },
  trattative: { tipo: "trattativa", dove: ["azienda.nome", "azienda.telefono", "persona.nome", "persona.telefono", "persona.email", "prossimo_passo", "note"], norma: false, vive: true,
    colonne: ["azienda.nome", "azienda.telefono", "persona.nome", "persona.telefono", "persona.email", "prossimo_passo", "note", "fase.nome", "valore", "azienda_id", "persona_id"],
    ordine: [{ campo: "mossa_il", dir: "desc" }],
    mostra: (r) => ({ nome: r["azienda.nome"] || r["persona.nome"] || "Trattativa senza azienda", fase: r["fase.nome"], valore: r.valore, azienda_id: r.azienda_id, persona_id: r.persona_id }) },
});

const COLONNE_VISTA = Object.freeze({
  trattative: ["azienda_id", "azienda.nome", "persona_id", "persona.nome", "fase_id", "fase.nome", "percorso", "valore", "prossimo_passo", "prossimo_il", "mossa_il", "segue", "archiviata_il"],
  aziende: ["nome", "stato", "telefono", "sito", "email", "comune", "categoria", "esito", "tentativi", "richiamare_il", "ultima_chiamata", "chiamato_da", "contatto_id", "etichetta"],
  persone: ["nome", "ruolo", "stato", "telefono", "email", "azienda_id", "azienda.nome", "archiviata_il"],
});
const TOTALI_VISTA = Object.freeze({ trattative: [{ fn: "somma", campo: "valore" }] });

const COLONNE_ATTIVITA = `id, tipo, esito, esito_azienda, testo, scadenza, fatto_il, durata, fase, quando, creato_da, assegnato_a, azienda_id, persona_id, trattativa_id`;
const TRATTATIVE_DI = `select t.id, t.azienda_id, t.persona_id, t.percorso, t.fase_id, f.nome as fase_nome, f.tipo as fase_tipo, t.valore, t.prossimo_passo, t.prossimo_il, t.mossa_il, t.segue, t.archiviata_il
    from crm.trattative t left join crm.fasi f on f.id = t.fase_id`;

export function creaMcp({ email, raccolteUrl, conLaSessione, servizi, versione = "sviluppo", intestazioni = {}, segnala = () => {} }) {
  const scrivi = daSocio(conLaSessione);

  const manda = (res, stato, corpo, testa = {}) => {
    if (res.headersSent) { res.end(); return; }
    if (corpo === undefined) { res.writeHead(stato, { ...intestazioni, "Cache-Control": "no-store", "Content-Length": 0, ...testa }); res.end(); return; }
    const s = JSON.stringify(corpo);
    res.writeHead(stato, { ...intestazioni, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(s), ...testa });
    res.end(s);
  };
  const erroreHttp = (res, stato, message, testa) => manda(res, stato, { jsonrpc: "2.0", id: null, error: { code: -32000, message } }, testa);

  const leggi = (email, vuoto, fn, { scrive = false } = {}) => conLaSessione(email, async (c) => {
    if (!scrive) await c.query("set transaction read only");
    if (!(await c.query(SOCIO_SQL)).rows[0].ok) return { ...vuoto, socio: false, nota: NON_SOCIO };
    return fn(c);
  });

  async function cerca(email, a, { motore }) {
    const testo = a.testo.trim();
    if (testo.length < 2) throw male("testo: almeno 2 caratteri");
    const minuscolo = testo.toLowerCase();
    const tipi = [...new Set(a.tipi ?? Object.keys(CERCA))];
    const limite = a.limite ?? 10;
    return leggi(email, { risultati: [], quante: 0 }, async (c) => {
      const tel = (await c.query("select app.norma_telefono($1::text) as n", [testo])).rows[0].n || "";
      const risultati = [], per_tipo = {};
      for (const nome of tipi) {
        const d = CERCA[nome];
        const condizioni = d.dove.map((campo) => ({ campo, op: "contiene", valore: testo }));
        const conNorma = d.norma && tel.length >= 6;
        if (conNorma) condizioni.push({ campo: "telefono_norm", op: "contiene", valore: tel });
        const filtri = d.vive ? { e: [{ campo: "archiviata_il", op: "vuoto" }, { o: condizioni }] } : { o: condizioni };
        const r = await motore.esegui(c, nome, { filtri, ordine: d.ordine, colonne: d.colonne, quanti: limite }, { email });
        per_tipo[nome] = r.totale;
        for (const riga of r.righe) {
          const combacia = d.dove.filter((campo) => String(riga[campo] ?? "").toLowerCase().includes(minuscolo));
          if (conNorma && String(riga.telefono_norm ?? "").includes(tel) && !combacia.includes("telefono")) combacia.push("telefono");
          risultati.push({ tipo: d.tipo, id: riga.id, ...d.mostra(riga), combacia });
        }
      }
      return { risultati, quante: risultati.length, per_tipo };
    });
  }

  async function timeline(c, colonna, id) {
    const { rows } = await c.query(`select ${COLONNE_ATTIVITA}, count(*) over ()::int as n_totale from crm.attivita
      where ${colonna} = $1 order by quando desc, id desc limit ${TIMELINE}`, [id]);
    return { timeline: rows.map(({ n_totale: _n, ...r }) => r), timeline_totale: rows[0]?.n_totale ?? 0 };
  }
  const nonTrovata = () => new ErroreApi(404, "non trovato");
  const aziendaLegata = async (c, id) => (id ? (await c.query(`select a.id, a.nome, a.telefono, a.comune, a.esito, ${statoTesto.aziende("a")} as stato from app.aziende a where a.id = $1`, [id])).rows[0] ?? null : null);

  const SCHEDE = {
    async azienda(c, id) {
      const riga = await leggiUna(c, id);
      if (!riga) throw nonTrovata();
      const { calcolati, ...resto } = riga;
      const scheda = { ...resto, ...calcolati };
      const persone = (await c.query(`select id, nome, ruolo, telefono, email, campi, archiviata_il from crm.persone where azienda_id = $1 order by nome, id`, [id])).rows;
      const trattative = (await c.query(`${TRATTATIVE_DI} where t.azienda_id = $1 order by t.mossa_il desc, t.id`, [id])).rows;
      return { scheda, persone, trattative, ...(await timeline(c, "azienda_id", id)) };
    },
    async persona(c, id) {
      const scheda = (await c.query(`select p.*, ${statoPersona("az")} from crm.persone p left join app.aziende az on az.id = p.azienda_id
        ${legamiStatoPersona("p", "az")} where p.id = $1`, [id])).rows[0];
      if (!scheda) throw nonTrovata();
      const azienda = await aziendaLegata(c, scheda.azienda_id);
      const trattative = (await c.query(`${TRATTATIVE_DI} where t.persona_id = $1 order by t.mossa_il desc, t.id`, [id])).rows;
      return { scheda, azienda, trattative, ...(await timeline(c, "persona_id", id)) };
    },
    async trattativa(c, id) {
      const scheda = (await c.query(`select t.*, f.nome as fase_nome, f.tipo as fase_tipo from crm.trattative t left join crm.fasi f on f.id = t.fase_id where t.id = $1`, [id])).rows[0];
      if (!scheda) throw nonTrovata();
      const azienda = await aziendaLegata(c, scheda.azienda_id);
      const persona = scheda.persona_id ? (await c.query(`select id, nome, ruolo, telefono, email from crm.persone where id = $1`, [scheda.persona_id])).rows[0] ?? null : null;
      return { scheda, azienda, persona, ...(await timeline(c, "trattativa_id", id)) };
    },
  };
  const scheda = (email, a) => leggi(email, { tipo: a.tipo, scheda: null, quante: 0 }, async (c) => ({ tipo: a.tipo, ...(await SCHEDE[a.tipo](c, a.id)) }));

  function esitoVista(r, soloGruppi) {
    const fuori = {};
    if (r.vista) fuori.vista = { id: r.vista.id, nome: r.vista.nome, tabella: r.vista.tabella, tipo: r.vista.tipo, gruppo: r.vista.gruppo };
    if (!soloGruppi) {
      fuori.righe = r.righe;
      fuori.quante = r.righe.length;
      fuori.inizio = r.inizio;
      fuori.altre = r.inizio + r.righe.length < r.totale;
      if (fuori.altre) fuori.prossimo_salta = r.inizio + r.righe.length;
    }
    fuori.totale = r.totale;
    if (Object.keys(r.totali).length) fuori.totali = r.totali;
    if (r.gruppi.length || soloGruppi) { fuori.gruppi = r.gruppi; fuori.gruppi_troncati = r.gruppi_troncati; }
    return fuori;
  }

  function vista(email, a, { motore, viste }) {
    const salvata = a.vista !== undefined;
    if (salvata && (a.filtri !== undefined || a.risorsa !== undefined)) throw male("o una vista salvata, o risorsa e filtri: non tutti e due");
    if (!salvata && a.filtri === undefined && a.risorsa === undefined) throw male("serve una vista, oppure risorsa o filtri");
    const inizio = a.salta ?? 0;
    const gruppi = a.raggruppa_per;
    const quanti = gruppi ? 0 : a.limite ?? 50;
    const vuoto = { righe: [], quante: 0, totale: 0 };
    if (salvata) {
      const quale = UUID.test(a.vista) ? { id: a.vista } : { nome: a.vista };
      return leggi(email, vuoto, async (c) => esitoVista(await viste.esegui(c, quale, { inizio, quanti, gruppi }, { email }), !!gruppi), { scrive: true });
    }
    const risorsa = a.risorsa ?? "trattative";
    return leggi(email, vuoto, async (c) => esitoVista(await motore.esegui(c, risorsa, {
      filtri: a.filtri, colonne: COLONNE_VISTA[risorsa], inizio, quanti, gruppi: gruppi ?? [], totali: gruppi ? TOTALI_VISTA[risorsa] ?? [] : [],
    }, { email }), !!gruppi));
  }

  function corpoDa(valori) {
    const voci = Object.entries(valori);
    if (voci.length < 1 || voci.length > 40) throw male("valori: da 1 a 40 campi");
    const corpo = {}, campi = {};
    for (const [k, v] of voci) {
      if (v !== null && typeof v === "object") throw male("valori: solo testi, numeri, sì/no o null");
      if (k.startsWith("campi.")) {
        const chiave = k.slice(6);
        if (!CHIAVE_CAMPO.test(chiave)) throw male("valori: nome di campo personalizzato non valido", "colonna");
        campi[chiave] = v;
      } else {
        if (!COLONNA.test(k) || k === "campi") throw male("valori: nome di campo non valido (i personalizzati sono campi.<chiave>)", "colonna");
        corpo[k] = v;
      }
    }
    if (Object.keys(campi).length) corpo.campi = campi;
    return corpo;
  }

  const faseDi = (email, fase, percorso) => scrivi(email, async (c) => (await c.query(`select id, percorso from crm.fasi
    where ($2::text is null or percorso = $2) and ($1::text is null and tipo = 'aperta' or id = $1 or lower(nome) = lower($1))
    order by id = $1 desc nulls last, percorso_ordine, ordine, id limit 1`, [fase, percorso])).rows[0]);

  async function crea(email, a, { aziende, dati }) {
    const corpo = corpoDa(a.valori);
    const cerca = new URLSearchParams();
    if (a.tipo === "azienda") {
      const r = await aziende({ metodo: "POST", risorsa: "aziende", cerca, corpo, email });
      return { tipo: "azienda", id: r.corpo.id, nuova: r.corpo.nuova, ...(r.corpo.nuova ? {} : { chiave: r.corpo.chiave }), riga: r.corpo };
    }
    if (a.tipo === "persona") {
      const r = await dati({ metodo: "POST", risorsa: "persone", cerca, corpo, email });
      return { tipo: "persona", id: r.corpo.id, nuova: true, riga: r.corpo };
    }
    const { nome, fase, fase_id, ...resto } = corpo;
    const chiesta = fase ?? fase_id;
    if (typeof chiesta === "string" || typeof resto.percorso === "string") {
      const f = await faseDi(email, chiesta ?? null, resto.percorso ?? null);
      if (!f) throw male(chiesta ? "fase sconosciuta in questo percorso" : "questo percorso non ha una fase aperta");
      resto.fase_id = f.id; resto.percorso = f.percorso;
    }
    if (typeof nome === "string" && nome.trim()) resto.note = [nome.trim(), resto.note].filter(Boolean).join("\n");
    if (resto.segue === undefined) resto.segue = email;
    const r = await dati({ metodo: "POST", risorsa: "trattative", cerca, corpo: resto, email });
    return { tipo: "trattativa", id: r.corpo.id, nuova: true, riga: r.corpo, ...(nome ? { nota: "Una trattativa non ha un nome suo: «nome» è in testa alle note." } : {}) };
  }

  async function istante(c, quando, tipo) {
    const soloGiorno = GIORNO.test(quando);
    const testo = soloGiorno ? `${quando}T${tipo === "compito" ? "23:59:59" : "00:00:00"}` : quando;
    const { rows } = await c.query(CON_FUSO.test(testo)
      ? `select t, t <= now() as passato from (select $1::timestamptz as t) x`
      : `select t, t <= now() as passato from (select ($1::timestamp at time zone 'Europe/Rome') as t) x`, [testo]);
    if (tipo !== "compito" && rows[0].passato && !soloGiorno) throw male("quando è già passato");
    return rows[0].t;
  }

  function attivita(email, a) {
    if (!a.trattativa_id && !a.azienda_id && !a.persona_id) throw male("serve trattativa_id, azienda_id o persona_id (da crm_cerca)");
    if (a.esito !== undefined && a.tipo !== "chiamata") throw male("esito vale solo per una chiamata");
    if (a.quando !== undefined && a.tipo !== "compito" && a.esito !== "richiamare") throw male("quando vale per un compito o per una chiamata «richiamare»");
    if (a.assegnato_a !== undefined) {
      if (a.tipo !== "compito") throw male("assegnato_a vale solo per un compito");
    }
    return scrivi(email, async (c) => {
      let { trattativa_id = null, persona_id = null, azienda_id = null } = a;
      if (trattativa_id) {
        const t = (await c.query(`select azienda_id, persona_id from crm.trattative where id = $1`, [trattativa_id])).rows[0];
        if (!t) throw nonTrovata();
        azienda_id ??= t.azienda_id; persona_id ??= t.persona_id;
      }
      if (persona_id) {
        const p = (await c.query(`select azienda_id from crm.persone where id = $1`, [persona_id])).rows[0];
        if (!p) throw nonTrovata();
        azienda_id ??= p.azienda_id;
      }
      const suAzienda = a.tipo === "chiamata" && azienda_id !== null && trattativa_id === null;
      const e = a.esito ? ESITI[a.esito] : null;
      let prima = null;
      if (suAzienda) {
        prima = (await c.query(`select tentativi from app.aziende where id = $1 for update`, [azienda_id])).rows[0];
        if (!prima) throw nonTrovata();
      }
      const scadenza = a.quando === undefined ? null : await istante(c, a.quando, a.tipo);
      const assegnato = a.assegnato_a === undefined ? null : a.assegnato_a.trim().toLowerCase();
      if (assegnato && !(await c.query(`select 1 from app.soci where lower(email) = $1`, [assegnato])).rows.length) throw male("assegnato_a: un compito si dà solo a un socio");
      const riga = (await c.query(`insert into crm.attivita (tipo, azienda_id, persona_id, trattativa_id, esito, esito_azienda, testo, scadenza, assegnato_a)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning ${COLONNE_ATTIVITA}`,
      [a.tipo, azienda_id, persona_id, trattativa_id, e?.attivita ?? null, suAzienda ? e?.azienda ?? null : null, a.testo, scadenza, assegnato])).rows[0];
      if (!suAzienda) return { attivita: riga };
      const azienda = (await c.query(`select id, esito, tentativi, richiamare_il, ultima_chiamata, chiamato_da from app.aziende where id = $1`, [azienda_id])).rows[0];
      if (azienda.tentativi !== prima.tentativi + 1) {
        const nota = (await c.query(`select errore_sqlstate from crm.ponte_registro where riga_id = $1 order by quando desc limit 1`, [riga.id])).rows[0];
        console.error(`mcp: crm_attivita: il ponte non ha aggiornato l'azienda (${azienda_id}, sqlstate ${nota?.errore_sqlstate || "nessuno"})`);
        throw new ErroreApi(503, "l'azienda non si è aggiornata: non è stato salvato niente, riprova", "ponte");
      }
      return { attivita: riga, azienda };
    });
  }

  const ESEGUI = { crm_cerca: cerca, crm_scheda: scheda, crm_vista: vista, crm_crea: crea, crm_attivita: attivita , ...creaRaccolteMcp({ url: raccolteUrl }) };

  async function chiamaStrumento(email, params, serv) {
    const nome = params?.name;
    const s = typeof nome === "string" ? PER_NOME.get(nome) : undefined;
    if (!s) throw new ErroreMcp(-32602, `strumento sconosciuto: ${String(nome).slice(0, 80)}`);
    const args = params.arguments ?? {};
    if (typeof args !== "object" || Array.isArray(args)) throw new ErroreMcp(-32602, "arguments: serve un oggetto");
    const schema = s.inputSchema;
    for (const k of Object.keys(args)) if (!Object.hasOwn(schema.properties, k)) throw new ErroreMcp(-32602, `argomento sconosciuto per ${nome}: ${k.slice(0, 80)}`);
    for (const k of schema.required || []) if (args[k] === undefined) throw new ErroreMcp(-32602, `manca l'argomento ${k}`);
    const t0 = Date.now();
    const rifiuto = (messaggio) => {
      console.log(`mcp: ${nome} rifiutato ${Date.now() - t0}ms`);
      return { content: [{ type: "text", text: messaggio }], isError: true };
    };
    try {
      for (const [k, v] of Object.entries(args)) if (v !== undefined) controlla(schema.properties[k], v, k);
      const testo = JSON.stringify(await ESEGUI[nome](email, args, serv));
      console.log(`mcp: ${nome} ok ${Date.now() - t0}ms ${testo.length}c`);
      if (testo.length > LIMITE_RISPOSTA) return rifiuto(`Risposta troppo grande (${testo.length} caratteri): restringi la richiesta: meno righe (limite), filtri più stretti, o una scheda alla volta.`);
      return { content: [{ type: "text", text: testo }] };
    } catch (e) {
      if (e instanceof ErroreApi) return rifiuto(e.message);
      const pg = traduciErrorePg(e);
      if (pg) return rifiuto(`il database dice: ${pg.message}`);
      console.error(`mcp: ${nome}: ${senzaContatti(String(e?.message || e).split("\n")[0]).slice(0, 200)}`);
      segnala(e, { servizio: "crm", percorso: "/crm/mcp", metodo: nome });
      return rifiuto("errore del servizio");
    }
  }

  async function messaggio(email, m, serv) {
    const valido = m && typeof m === "object" && !Array.isArray(m) && m.jsonrpc === "2.0";
    const haId = valido && Object.hasOwn(m, "id") && (typeof m.id === "string" || (typeof m.id === "number" && Number.isFinite(m.id)));
    if (!valido || typeof m.method !== "string") {
      if (valido && (Object.hasOwn(m, "result") || Object.hasOwn(m, "error"))) return undefined;
      return { jsonrpc: "2.0", id: haId ? m.id : null, error: { code: -32600, message: "richiesta JSON-RPC non valida" } };
    }
    if (!haId) return undefined;
    const ok = (result) => ({ jsonrpc: "2.0", id: m.id, result });
    try {
      switch (m.method) {
        case "initialize": {
          const chiesta = m.params?.protocolVersion;
          return ok({ protocolVersion: VERSIONI.includes(chiesta) ? chiesta : VERSIONI[0], capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "crm", title: "CRM", version: versione }, instructions: ISTRUZIONI });
        }
        case "ping": return ok({});
        case "tools/list": return ok({ tools: TUTTI });
        case "tools/call": return ok(await chiamaStrumento(email, m.params, serv));
        case "resources/list": return ok({ resources: [] });
        case "resources/templates/list": return ok({ resourceTemplates: [] });
        case "prompts/list": return ok({ prompts: [] });
        default: throw new ErroreMcp(-32601, `metodo sconosciuto: ${m.method.slice(0, 80)}`);
      }
    } catch (e) {
      if (e instanceof ErroreMcp) return { jsonrpc: "2.0", id: m.id, error: { code: e.codice, message: e.message } };
      console.error(`mcp: ${senzaContatti(String(e?.message || e).split("\n")[0]).slice(0, 200)}`);
      return { jsonrpc: "2.0", id: m.id, error: { code: -32603, message: "errore del servizio" } };
    }
  }

  return async function mcp(req, res) {
    const origine = req.headers.origin;
    if (origine !== undefined) {
      let host = "";
      try { host = new URL(origine).host; } catch { }
      if (!host || host !== String(req.headers.host || "")) return erroreHttp(res, 403, "origine non ammessa");
    }
    if (req.method !== "POST") return erroreHttp(res, 405, "metodo non ammesso: solo POST (nessun flusso SSE)", { Allow: "POST" });
    const protocollo = req.headers["mcp-protocol-version"];
    if (protocollo !== undefined && !VERSIONI.includes(protocollo)) return erroreHttp(res, 400, `MCP-Protocol-Version non supportata: ${String(protocollo).slice(0, 40)}`);
    if (!/^application\/json\b/i.test(String(req.headers["content-type"] || ""))) return erroreHttp(res, 415, "il corpo va in JSON (application/json)");
    const serv = servizi();
    if (!serv) return erroreHttp(res, 503, "il servizio si sta avviando");
    const pezzi = []; let n = 0;
    for await (const p of req) { n += p.length; if (n > LIMITE_CORPO) return erroreHttp(res, 413, "corpo oltre 1 MB"); pezzi.push(p); }
    let corpo;
    try { corpo = JSON.parse(Buffer.concat(pezzi).toString("utf8")); }
    catch { return manda(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON non valido" } }); }

    if (Array.isArray(corpo)) {
      if (!corpo.length || corpo.length > 20) return manda(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "elenco vuoto o oltre 20 messaggi" } });
      const risposte = [];
      for (const m of corpo) { const r = await messaggio(email, m, serv); if (r) risposte.push(r); }
      return risposte.length ? manda(res, 200, risposte) : manda(res, 202, undefined);
    }
    const r = await messaggio(email, corpo, serv);
    return r ? manda(res, 200, r) : manda(res, 202, undefined);
  };
}

export const STRUMENTI_MCP = TUTTI;
