import { SOCIO_SQL } from "./db.mjs";
import { MIA_O_DI_NESSUNO } from "./oggi.mjs";
import { ErroreApi, NON_AZIENDA, pertinente } from "./regole.mjs";

export const MAX_TENTATIVI = 3;
const RICONTROLLI = 5;
const PAGINA = 50, PAGINE = 20;
const DURATA_MAX = 86_400, TESTO_MAX = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/i;
const PERCORSO_FREDDO = "freddo";
export const percorsoDiOggi = (percorsi) => (percorsi.some((p) => p.id === PERCORSO_FREDDO) ? PERCORSO_FREDDO : percorsi[0]?.id ?? null);
const URL_TRATTATIVA = "/crm/api/trattative/da-azienda";

export const ESITI = Object.freeze({
  "non-risponde": { attivita: "non-risponde", azienda: "non-risponde" },
  occupato: { attivita: "non-risponde", azienda: "non-risponde" },
  richiamare: { attivita: "richiamare", azienda: "richiamare" },
  "non-interessato": { attivita: "risposto", azienda: "non-interessato" },
  interessato: { attivita: "risposto", azienda: "interessato" },
});

export function filtriCoda(adesso) {
  const senzaContatto = { campo: "contatto_id", op: "vuoto" };
  const azienda = { campo: "etichetta", op: "diverso", valore: NON_AZIENDA };
  return {
    richiami: [senzaContatto, azienda, { campo: "esito", op: "uguale", valore: "richiamare" },
      { o: [{ campo: "richiamare_il", op: "vuoto" }, { campo: "richiamare_il", op: "minore", valore: adesso }] }],
    da_chiamare: [senzaContatto, azienda, { o: [{ campo: "esito", op: "uguale", valore: "da-chiamare" },
      { e: [{ campo: "esito", op: "uguale", valore: "non-risponde" }, { campo: "tentativi", op: "minore", valore: MAX_TENTATIVI }] }] }],
  };
}
const ORDINE = Object.freeze({
  richiami: [{ campo: "richiamare_il" }, { campo: "nome" }],
  da_chiamare: [{ campo: "tentativi" }, { campo: "esito" }, { campo: "nome" }],
});
const SQL_LISTA = Object.freeze({
  richiami: { dove: `a.esito = 'richiamare' and (a.richiamare_il is null or a.richiamare_il < $2::timestamptz)`,
    ordine: `a.richiamare_il asc nulls last, a.nome asc, a.id asc`, conAdesso: true },
  da_chiamare: { dove: `(a.esito = 'da-chiamare' or (a.esito = 'non-risponde' and a.tentativi < ${MAX_TENTATIVI}))`,
    ordine: `a.tentativi asc, a.esito asc, a.nome asc, a.id asc`, conAdesso: false },
});
const AZIENDA_DA_LISTA = `from app.liste_aziende l join app.aziende a on a.id = l.azienda_id where l.lista_id = $1 and a.contatto_id is null and ${pertinente("a")}`;

const corpoOggetto = (corpo, ammessi) => {
  const o = corpo === undefined || corpo === null ? {} : corpo;
  if (typeof o !== "object" || Array.isArray(o)) throw new ErroreApi(400, "il corpo è un oggetto", "valore");
  if (Object.keys(o).some((k) => !ammessi.includes(k))) throw new ErroreApi(400, `campo fuori lista: ci sono ${ammessi.join(", ")}`, "colonna");
  return o;
};
const uuidDi = (v, nome) => {
  if (typeof v !== "string" || !UUID.test(v)) throw new ErroreApi(400, `${nome} non valido`, "valore");
  return v;
};
const minuscola = (email) => String(email).toLowerCase();

export const lasciaLeMie = (c, email, aziendaId = null) => c.query(
  `delete from crm.coda_prese where preso_da = $1 and ($2::uuid is null or azienda_id = $2::uuid)`, [minuscola(email), aziendaId]);

export async function scriviChiamata(c, e, email, tentativi) {
  const doppia = (await c.query(`select * from crm.attivita
    where azienda_id = $1 and tipo = 'chiamata' and trattativa_id is null and creato_da = $2 and esito_azienda = $3
      and quando > now() - interval '5 seconds' order by quando desc, id desc limit 1`, [e.azienda_id, minuscola(email), e.esito.azienda])).rows[0];
  const attivita = doppia || (await c.query(`insert into crm.attivita (tipo, azienda_id, esito, esito_azienda, testo, scadenza, durata)
    values ('chiamata', $1, $2, $3, $4, $5, $6) returning *`,
  [e.azienda_id, e.esito.attivita, e.esito.azienda, e.testo, e.scadenza, e.durata])).rows[0];
  const azienda = (await c.query(`select id, esito, tentativi, richiamare_il, ultima_chiamata, chiamato_da from app.aziende where id = $1`, [e.azienda_id])).rows[0];
  if (!doppia && azienda.tentativi !== tentativi + 1) {
    const nota = (await c.query(`select errore_sqlstate from crm.ponte_registro where riga_id = $1 order by quando desc limit 1`, [attivita.id])).rows[0];
    console.error(`coda/esito: il ponte non ha aggiornato l'azienda (${e.azienda_id}, sqlstate ${nota?.errore_sqlstate || "nessuno"})`);
    throw new ErroreApi(503, "l'azienda non si è aggiornata: non è stato salvato niente, riprova", "ponte");
  }
  return { attivita, azienda, doppia: !!doppia };
}

function nodiDellaVista(filtri) {
  if (Array.isArray(filtri) && !filtri.length) return [];
  const soloE = filtri && typeof filtri === "object" && !Array.isArray(filtri) && Object.keys(filtri).length === 1 && Array.isArray(filtri.e);
  return soloE ? filtri.e : [filtri];
}

export function creaCoda({ conLaSessione, motore, ora = () => Date.now() }) {
  const soloSoci = async (c) => {
    if (!(await c.query(SOCIO_SQL)).rows[0].ok) throw new ErroreApi(403, "solo gli utenti usano la coda", "socio");
  };

  async function sorgente(c, { vista_id, lista_id }, email) {
    if (vista_id !== undefined && lista_id !== undefined) throw new ErroreApi(400, "o una vista o una lista", "valore");
    if (lista_id !== undefined) {
      const { rows } = await c.query(`select id from app.liste_freddo where id = $1`, [uuidDi(lista_id, "lista_id")]);
      if (!rows.length) throw new ErroreApi(404, "non trovato");
      return { lista: rows[0].id };
    }
    if (vista_id === undefined) return { filtri: [MIA_O_DI_NESSUNO] };
    const v = (await c.query(`select tabella, di, filtri from crm.viste where id = $1`, [uuidDi(vista_id, "vista_id")])).rows[0];
    if (!v || (v.di !== "team" && v.di !== minuscola(email))) throw new ErroreApi(404, "non trovato");
    if (v.tabella !== "aziende") throw new ErroreApi(400, "la coda parte da una vista di aziende", "valore");
    return { filtri: nodiDellaVista(v.filtri) };
  }

  async function pagina(c, da, gruppo, adesso, email, inizio) {
    if (da.lista) {
      const s = SQL_LISTA[gruppo], base = [da.lista, ...(s.conAdesso ? [adesso] : [])];
      const totale = Number((await c.query(`select count(*)::bigint as n ${AZIENDA_DA_LISTA} and ${s.dove}`, base)).rows[0].n);
      const { rows } = await c.query(`select a.id, a.tentativi ${AZIENDA_DA_LISTA} and ${s.dove} order by ${s.ordine}
        limit ${PAGINA} offset ${Number(inizio)}`, base);
      return { ids: rows.map((r) => r.id), tentativi: new Map(rows.map((r) => [r.id, r.tentativi])), totale };
    }
    const r = await motore.esegui(c, "aziende", { filtri: { e: [...da.filtri, ...filtriCoda(adesso)[gruppo]] }, ordine: ORDINE[gruppo],
      colonne: ["id", "tentativi"], inizio, quanti: PAGINA }, { email, grezzi: true });
    return { ids: r.righe.map((x) => x.id), tentativi: new Map(r.righe.map((x) => [x.id, x.tentativi])), totale: r.totale };
  }

  async function valeAncora(c, da, gruppo, adesso, email, id, letti) {
    if (da.lista) {
      const s = SQL_LISTA[gruppo], base = [da.lista, ...(s.conAdesso ? [adesso] : []), id];
      const { rows } = await c.query(`select a.tentativi ${AZIENDA_DA_LISTA} and ${s.dove} and a.id = $${base.length}::uuid`, base);
      return rows.length === 1 && rows[0].tentativi === letti;
    }
    const r = await motore.esegui(c, "aziende", { filtri: { e: [...da.filtri, ...filtriCoda(adesso)[gruppo], { campo: "id", op: "uguale", valore: id }] },
      colonne: ["id", "tentativi"], quanti: 1 }, { email, grezzi: true });
    return r.righe.length === 1 && r.righe[0].tentativi === letti;
  }

  async function carta(c, id) {
    const azienda = (await c.query(`select a.id, a.nome, a.telefono, a.telefono_norm, a.sito, a.email, a.indirizzo, a.comune, a.categoria,
        a.valutazione, a.recensioni, a.referente, a.note, a.esito, a.tentativi, a.richiamare_il, a.ultima_chiamata, a.chiamato_da,
        coalesce(nullif(a.telefono_norm, ''), app.norma_telefono(a.telefono)) as numero
      from app.aziende a where a.id = $1`, [id])).rows[0];
    const persona = (await c.query(`select id, nome, ruolo, telefono, telefono_norm, email from crm.persone
      where azienda_id = $1 and archiviata_il is null
      order by (ruolo <> '') desc, (lower(trim(nome)) = lower(trim($2))) desc, creato, id limit 1`, [id, azienda.referente])).rows[0] || null;
    const { rows: attivita } = await c.query(`select id, tipo, esito, esito_azienda, testo, scadenza, durata, quando, creato_da, persona_id,
        trattativa_id from crm.attivita where azienda_id = $1 order by quando desc, id desc limit 3`, [id]);
    const { numero, ...resto } = azienda;
    return { azienda: resto, numero: numero || persona?.telefono_norm || "",
      chi_chiedere: { referente: azienda.referente.trim(), persona }, attivita };
  }

  async function prossima({ corpo, email }) {
    const chiesto = corpoOggetto(corpo, ["vista_id", "lista_id"]);
    const adesso = new Date(ora()).toISOString();
    return conLaSessione(email, async (c) => {
      await soloSoci(c);
      const da = await sorgente(c, chiesto, email);
      await lasciaLeMie(c, email);
      const prime = { richiami: await pagina(c, da, "richiami", adesso, email, 0), da_chiamare: await pagina(c, da, "da_chiamare", adesso, email, 0) };
      const in_coda = prime.richiami.totale + prime.da_chiamare.totale;
      const scartate = new Set();
      for (const gruppo of ["richiami", "da_chiamare"]) {
        let p = prime[gruppo];
        for (let n = 1; p.ids.length; n++) {
          let candidate = p.ids.filter((id) => !scartate.has(id));
          while (candidate.length) {
            const presa = (await c.query(`select crm.prendi_dalla_coda($1::uuid[]) as id`, [candidate])).rows[0].id;
            if (!presa) break;
            if (await valeAncora(c, da, gruppo, adesso, email, presa, p.tentativi.get(presa))) {
              const { fino_a } = (await c.query(`select fino_a from crm.coda_prese where azienda_id = $1`, [presa])).rows[0];
              return { stato: 200, corpo: { ...(await carta(c, presa)), presa: { fino_a },
                perche: gruppo === "richiami" ? "richiamo" : "da-chiamare", in_coda } };
            }
            await c.query(`delete from crm.coda_prese where azienda_id = $1 and preso_da = $2`, [presa, minuscola(email)]);
            scartate.add(presa);
            console.log(`coda/prossima: azienda cambiata fra lettura e presa, si passa alla successiva (${presa})`);
            if (scartate.size >= RICONTROLLI) return { stato: 200, corpo: { azienda: null, in_coda } };
            candidate = candidate.filter((id) => id !== presa);
          }
          if (n >= PAGINE || n * PAGINA >= p.totale) break;
          p = await pagina(c, da, gruppo, adesso, email, n * PAGINA);
        }
      }
      return { stato: 200, corpo: { azienda: null, in_coda } };
    });
  }

  function leggiEsito(corpo) {
    const o = corpoOggetto(corpo, ["azienda_id", "esito", "quando", "durata", "testo"]);
    const azienda_id = uuidDi(o.azienda_id, "azienda_id");
    if (typeof o.esito !== "string" || !Object.hasOwn(ESITI, o.esito)) throw new ErroreApi(400, `esito fuori lista: ci sono ${Object.keys(ESITI).join(", ")}`, "valore");
    let scadenza = null;
    if (o.esito === "richiamare") {
      const t = typeof o.quando === "string" && ISTANTE.test(o.quando) ? Date.parse(o.quando) : NaN;
      if (!Number.isFinite(t)) throw new ErroreApi(400, "richiamare vuole quando: un istante col fuso", "valore");
      if (t <= ora()) throw new ErroreApi(400, "quando è già passato", "valore");
      scadenza = new Date(t).toISOString();
    } else if (o.quando !== undefined && o.quando !== null) {
      throw new ErroreApi(400, "quando vale solo per richiamare", "valore");
    }
    const durata = o.durata ?? null;
    if (durata !== null && (!Number.isInteger(durata) || durata < 0 || durata > DURATA_MAX)) throw new ErroreApi(400, `durata: i secondi, fino a ${DURATA_MAX}`, "valore");
    const testo = o.testo ?? "";
    if (typeof testo !== "string" || testo.length > TESTO_MAX || testo.includes("\0")) throw new ErroreApi(400, `testo: fino a ${TESTO_MAX} caratteri`, "valore");
    return { azienda_id, esito: ESITI[o.esito], scadenza, durata, testo };
  }

  async function esito({ corpo, email }) {
    const e = leggiEsito(corpo);
    return conLaSessione(email, async (c) => {
      await soloSoci(c);
      const prima = (await c.query(`select tentativi from app.aziende where id = $1 for update`, [e.azienda_id])).rows[0];
      if (!prima) throw new ErroreApi(404, "non trovato");
      const { attivita, azienda, doppia } = await scriviChiamata(c, e, email, prima.tentativi);
      await lasciaLeMie(c, email, e.azienda_id);
      const risposta = { attivita, azienda };
      if (doppia) risposta.ripetuto = true;
      if (e.esito.azienda === "interessato") {
        const { rows: percorsi } = await c.query(`select id, nome from app.percorsi order by ordine, id`);
        risposta.proposta = { url: URL_TRATTATIVA, azienda_id: e.azienda_id,
          percorso: percorsoDiOggi(percorsi), percorsi };
      }
      return { stato: doppia ? 200 : 201, corpo: risposta };
    });
  }

  async function rilascia({ corpo, email }) {
    const o = corpoOggetto(corpo, ["azienda_id"]);
    const azienda = o.azienda_id === undefined ? null : uuidDi(o.azienda_id, "azienda_id");
    return conLaSessione(email, async (c) => {
      await soloSoci(c);
      return { stato: 200, corpo: { rilasciate: (await lasciaLeMie(c, email, azienda)).rowCount } };
    });
  }

  const AZIONI = { prossima, esito, rilascia };
  return async function coda({ metodo, azione, cerca, corpo, email }) {
    if (!Object.hasOwn(AZIONI, azione)) throw new ErroreApi(404, "non trovato");
    if (metodo !== "POST") throw new ErroreApi(405, "metodo non ammesso", "metodo");
    if ([...cerca.keys()].length) throw new ErroreApi(400, "parametro fuori lista", "parametro");
    return AZIONI[azione]({ corpo, email });
  };
}
