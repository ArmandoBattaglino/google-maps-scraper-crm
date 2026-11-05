import { SOCIO_SQL } from "./db.mjs";
import { leggiVoce, scriviArrivo } from "./origini.mjs";
import { ErroreApi, regole, q } from "./regole.mjs";
import { colonnaCalcolati, legamiStatoAzienda, statoAzienda } from "./stato.mjs";

export const daSocio = (conLaSessione) => (email, fn) => conLaSessione(email, async (c) => {
  if (!(await c.query(SOCIO_SQL)).rows[0].ok) throw new ErroreApi(403, "solo gli utenti scrivono nel CRM", "socio");
  return fn(c);
});

const ORDINE = ["place_id", "piva", "telefono", "sito", "email", "nome"];
const FORTI = ["place_id", "piva", "telefono", "sito"];
const DERIVATE = new Set(["dominio", "telefono_norm"]);
const DEL_POSTO = new Set(["nome", "telefono", "sito", "piva", "email", "place_id", "dati"]);
const DELLE_LETTURE = new Set(["persona_id", "persona_nome", "trattativa_avvio", "trattativa_canone", "persona_ruolo", "persona_telefono", "persona_email", "trattativa_valore", "trattativa_passo", "trattativa_il", "nuova", "chiave", "trattative_aperte", "cliente", "ultima_attivita", "stato", "calcolati", "trattative_totali",
  "persone", "persone_totali", "da_dove", "ultima", "ultima_nota", "tag", "etichetta"]);
const VERIFICA = new Set(["nome", "telefono", "sito", "piva", "email", "place_id", "escludi"]);
const LIMITE_VERIFICA = 20;
const LIMITI = { nome: 300, telefono: 100, sito: 2000, piva: 30, email: 320, place_id: 300 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESITI_COMUNI = new Set(["non-risponde", "richiamare"]);
const nonOccupato = (e) => (e === "occupato" ? "non-risponde" : e);

export function corpoAttivita(metodo, id, corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return corpo;
  const c = { ...corpo };
  if (c.esito !== undefined) c.esito = nonOccupato(c.esito);
  if (c.esito_azienda !== undefined) c.esito_azienda = nonOccupato(c.esito_azienda);
  if (metodo === "POST" && id === undefined && c.tipo === "chiamata" && c.azienda_id && !c.trattativa_id) {
    if (c.esito_azienda == null && ESITI_COMUNI.has(c.esito)) c.esito_azienda = c.esito;
    if (c.esito == null && ESITI_COMUNI.has(c.esito_azienda)) c.esito = c.esito_azienda;
  }
  return c;
}

function testo(corpo, nome) {
  const v = corpo[nome];
  if (v === undefined || v === null) return "";
  if (typeof v !== "string" || v.length > LIMITI[nome]) throw new ErroreApi(400, `${nome}: testo fino a ${LIMITI[nome]} caratteri`, "valore");
  return v.trim();
}
const oggetto = (corpo) => {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new ErroreApi(400, "il corpo è un oggetto", "valore");
  return corpo;
};
const pivaNonValida = () => new ErroreApi(400, "P.IVA non valida: servono 11 cifre con la cifra di controllo giusta", "piva");

class Doppione extends ErroreApi {
  constructor(chiave, azienda_id) {
    super(409, chiave === "piva" ? "questa P.IVA è già di un'altra azienda" : "questa scheda di Maps è già di un'altra azienda", "doppione");
    this.chiave = chiave; this.azienda_id = azienda_id;
  }
}

async function norme(c, { telefono = "", sito = "", piva = "" }) {
  const r = await c.query(`select app.norma_telefono($1::text) as tel, app.norma_dominio($2::text) as dom,
    app.piva_valida($3::text) as piva_ok, regexp_replace($3::text, '\\D', '', 'g') as piva`, [telefono, sito, piva]);
  return r.rows[0];
}

async function cerca(c, { place = "", piva = "", tel = "", dom = "", email = "", nome = "" }, escludi = null) {
  const params = [], pezzi = [];
  const ramo = (valore, sql) => { if (!valore) return; params.push(valore); pezzi.push(sql(`$${params.length}::text`)); };
  const conChiave = (chiave, tipo, colonna) => (n) => `
    select k.azienda_id as id, '${chiave}' as chiave, k.usi >= 2 as condivisa from app.aziende_chiavi k where k.tipo = '${tipo}' and k.valore = ${n}
    union all
    select a.id, '${chiave}', exists (select 1 from app.aziende_chiavi k where k.tipo = '${tipo}' and k.valore = ${n} and k.usi >= 2)
      from app.aziende a where a.${colonna} = ${n}`;
  ramo(place, conChiave("place_id", "place_id", "place_id"));
  ramo(piva, conChiave("piva", "piva", "piva"));
  ramo(tel, conChiave("telefono", "telefono", "telefono_norm"));
  ramo(dom, conChiave("sito", "dominio", "dominio"));
  ramo(email, (n) => `select a.id, 'email' as chiave, false as condivisa from app.aziende a where lower(a.email) = ${n}`);
  ramo(nome, (n) => `select a.id, 'nome' as chiave, false as condivisa from app.aziende a where lower(trim(a.nome)) = ${n}`);
  const trovate = new Map();
  if (!pezzi.length) return trovate;
  params.push(escludi);
  const { rows } = await c.query(`select x.id, x.chiave, x.condivisa from (${pezzi.join(" union all ")}) x
    join app.aziende a on a.id = x.id
    where $${params.length}::uuid is null or x.id <> $${params.length}::uuid
    order by a.creato, a.id`, params);
  for (const r of rows) {
    const t = trovate.get(r.id) || { chiavi: [], condivise: [] };
    if (!t.chiavi.includes(r.chiave)) t.chiavi.push(r.chiave);
    if (r.condivisa && !t.condivise.includes(r.chiave)) t.condivise.push(r.chiave);
    trovate.set(r.id, t);
  }
  for (const t of trovate.values()) t.chiavi.sort((a, b) => ORDINE.indexOf(a) - ORDINE.indexOf(b));
  return trovate;
}

const COMBINATA = `
  select a.*, s.segue, coalesce(s.campi, '{}'::jsonb) as campi, ${statoAzienda("a")}, ${colonnaCalcolati("a", "s.segue")},
         (select count(*)::int from crm.trattative t where t.azienda_id = a.id) as trattative_totali,
         (select count(*)::int from crm.trattative t join crm.fasi f on f.id = t.fase_id
           where t.azienda_id = a.id and t.archiviata_il is null and f.tipo = 'aperta') as trattative_aperte,
         exists (select 1 from crm.trattative t join crm.fasi f on f.id = t.fase_id
                  where t.azienda_id = a.id and t.archiviata_il is null and f.tipo = 'cliente') as cliente,
         greatest((select max(x.quando) from crm.attivita x where x.azienda_id = a.id),
                  (select max(x.quando) from crm.attivita x join crm.trattative t on t.id = x.trattativa_id where t.azienda_id = a.id)) as ultima_attivita
    from app.aziende a left join crm.schede_aziende s on s.azienda_id = a.id
    ${legamiStatoAzienda("a")}
   where a.id = any($1::uuid[])`;
export const leggiUna = async (c, id) => (await c.query(COMBINATA, [[id]])).rows[0];

async function salvaScheda(c, id, { segue, campi }) {
  if (segue === undefined && campi === undefined) return;
  const valori = [id, segue ?? null, campi === undefined ? null : JSON.stringify(campi), segue !== undefined];
  const AGGIORNA = `segue = case when $4::boolean then $2::text else crm.schede_aziende.segue end,
                    campi = crm.schede_aziende.campi || coalesce($3::jsonb, '{}'::jsonb)`;
  if (segue == null && (!campi || !Object.keys(campi).length)) {
    await c.query(`update crm.schede_aziende set ${AGGIORNA} where azienda_id = $1::uuid
                   and (case when $4::boolean then $2::text else segue end, campi || coalesce($3::jsonb, '{}'::jsonb)) is distinct from (segue, campi)`, valori);
    return;
  }
  await c.query(`insert into crm.schede_aziende (azienda_id, segue, campi) values ($1::uuid, $2::text, coalesce($3::jsonb, '{}'::jsonb))
    on conflict (azienda_id) do update set ${AGGIORNA}
    where (case when $4::boolean then $2::text else crm.schede_aziende.segue end, crm.schede_aziende.campi || coalesce($3::jsonb, '{}'::jsonb))
          is distinct from (crm.schede_aziende.segue, crm.schede_aziende.campi)`, valori);
}

const togliChiave = (c, id, tipo, valore) => c.query(
  "delete from app.aziende_chiavi where tipo = $1 and valore = $2 and azienda_id = $3 and usi < 2", [tipo, valore, id]);
const altraCon = async (c, id, tipo, colonna, valore) => (await c.query(`
  select azienda_id as id from app.aziende_chiavi where tipo = $1 and valore = $2 and azienda_id <> $3
  union all select id from app.aziende where ${colonna} = $2 and id <> $3 limit 1`, [tipo, valore, id])).rows[0]?.id || null;

async function chiaveForte(c, id, tipo, colonna, valore) {
  const altra = await altraCon(c, id, tipo, colonna, valore);
  if (altra) throw new Doppione(tipo, altra);
  await c.query("insert into app.aziende_chiavi (tipo, valore, azienda_id) values ($1, $2, $3) on conflict (tipo, valore) do nothing", [tipo, valore, id]);
  const di = (await c.query("select azienda_id from app.aziende_chiavi where tipo = $1 and valore = $2", [tipo, valore])).rows[0]?.azienda_id;
  if (di && di !== id) throw new Doppione(tipo, di);
}

async function chiaveDebole(c, id, tipo, colonna, valore) {
  const altra = await altraCon(c, id, tipo, colonna, valore);
  await c.query(`insert into app.aziende_chiavi (tipo, valore, azienda_id) values ($1, $2, $3)
    on conflict (tipo, valore) do update set usi = app.aziende_chiavi.usi + 1 where app.aziende_chiavi.azienda_id <> excluded.azienda_id`, [tipo, valore, id]);
  return altra;
}

export function creaAziende({ conLaSessione, catalogo }) {
  const { risorsa, idValido, leggiCorpo } = regole(catalogo);
  const R = risorsa("aziende");
  const scrivi = daSocio(conLaSessione);
  const senzaParametri = (cerca) => { if ([...cerca.keys()].length) throw new ErroreApi(400, "parametro fuori lista", "parametro"); };

  function separa(corpo, opzioni) {
    const resto = {}, scheda = {};
    for (const [k, v] of Object.entries(oggetto(corpo))) {
      if (k === "voce" || k === "da_chi") continue;
      if (k === "segue") scheda.segue = v;
      else if (k === "campi") scheda.campi = v;
      else if (!DELLE_LETTURE.has(k)) resto[k] = v;
    }
    if (scheda.segue !== undefined && scheda.segue !== null && (typeof scheda.segue !== "string" || scheda.segue.length > 320)) {
      throw new ErroreApi(400, "segue: un'email fino a 320 caratteri", "valore");
    }
    if (scheda.campi !== undefined && (!scheda.campi || typeof scheda.campi !== "object" || Array.isArray(scheda.campi))) {
      throw new ErroreApi(400, "campi: serve un oggetto", "valore");
    }
    const colonne = new Map(leggiCorpo(R, resto, opzioni).filter(([k]) => !DERIVATE.has(k)));
    if (colonne.has("esito")) colonne.set("esito", nonOccupato(colonne.get("esito")));
    return { colonne, scheda };
  }

  async function verifica({ corpo, email }) {
    const b = oggetto(corpo);
    for (const k of Object.keys(b)) if (!VERIFICA.has(k)) throw new ErroreApi(400, `chiave fuori lista: ${k.slice(0, 40)}`, "colonna");
    if (b.escludi != null && (typeof b.escludi !== "string" || !UUID.test(b.escludi))) throw new ErroreApi(400, "escludi: serve un id", "valore");
    const piva = testo(b, "piva");
    return scrivi(email, async (c) => {
      const n = await norme(c, { telefono: testo(b, "telefono"), sito: testo(b, "sito"), piva });
      const trovate = await cerca(c, { place: testo(b, "place_id"), piva: n.piva_ok ? n.piva : "", tel: n.tel, dom: n.dom,
        email: testo(b, "email").toLowerCase(), nome: testo(b, "nome").toLowerCase() }, b.escludi ?? null);
      const prime = [...trovate.entries()]
        .sort((x, y) => ORDINE.indexOf(x[1].chiavi[0]) - ORDINE.indexOf(y[1].chiavi[0]))
        .slice(0, LIMITE_VERIFICA);
      const { rows } = await c.query(`select id, nome, telefono, sito, piva, email, comune, categoria, esito, contatto_id, unione
        from app.aziende where id = any($1::uuid[])`, [prime.map(([id]) => id)]);
      const righe = new Map(rows.map((r) => [r.id, r]));
      return { stato: 200, corpo: {
        aziende: prime.filter(([id]) => righe.has(id)).map(([id, t]) => ({ ...righe.get(id), chiave: t.chiavi[0], chiavi: t.chiavi, condivise: t.condivise })),
        piva_valida: piva ? n.piva_ok : null } };
    });
  }

  async function crea({ corpo, email }) {
    const b = oggetto(corpo);
    const { colonne, scheda } = separa(b);
    const nome = testo(b, "nome");
    if (!nome) throw new ErroreApi(400, "manca un valore (nome)", "23502");
    if (b.dati !== undefined && b.dati !== null && (typeof b.dati !== "object" || Array.isArray(b.dati))) throw new ErroreApi(400, "dati: serve un oggetto", "valore");
    const telefono = testo(b, "telefono"), sito = testo(b, "sito"), piva = testo(b, "piva"), place = testo(b, "place_id");
    const mail = testo(b, "email");
    const scelta = b.voce === undefined || b.voce === null ? null : leggiVoce(b);
    const ritorno = async (c, id) => { if (scelta) await scriviArrivo(c, { azienda_id: id, ...scelta }); };
    return scrivi(email, async (c) => {
      const n = await norme(c, { telefono, sito, piva });
      if (piva && !n.piva_ok) throw pivaNonValida();
      const pivaN = n.piva_ok ? n.piva : "";
      await c.query(`select pg_advisory_xact_lock(hashtext('azienda:' || coalesce(nullif($1::text, ''), nullif($2::text, ''),
        nullif($3::text, ''), nullif($4::text, ''), lower($5::text))))`, [place, pivaN, n.tel, n.dom, nome]);
      const trovate = await cerca(c, { place, piva: pivaN, tel: n.tel, dom: n.dom });
      let gia = null;
      for (const chiave of FORTI) {
        for (const [id, t] of trovate) if (t.chiavi.includes(chiave) && !t.condivise.includes(chiave)) { gia = { id, chiave }; break; }
        if (gia) break;
      }
      if (gia) {
        await ritorno(c, gia.id);
        return { stato: 200, corpo: { ...(await leggiUna(c, gia.id)), nuova: false, chiave: gia.chiave } };
      }

      const posto = { nome, telefono, sito, piva: pivaN, email: mail, place_id: place, ...(b.dati ? { dati: b.dati } : {}) };
      const id = (await c.query("select crm.trova_o_crea_azienda($1::jsonb) as id", [JSON.stringify(posto)])).rows[0].id;
      if (!(await c.query("select creato = now() as nuova from app.aziende where id = $1", [id])).rows[0].nuova) {
        await ritorno(c, id);
        return { stato: 200, corpo: { ...(await leggiUna(c, id)), nuova: false, chiave: null } };
      }
      const altre = [...colonne.entries()].filter(([k]) => !DEL_POSTO.has(k));
      if (altre.length) {
        await c.query(`update app.aziende set ${altre.map(([k], i) => `${q(k)} = $${i + 2}`).join(", ")} where id = $1`, [id, ...altre.map(([, v]) => v)]);
      }
      await salvaScheda(c, id, scheda);
      await scriviArrivo(c, { azienda_id: id, ...(scelta ?? { voce: "mano", da_chi: "" }) });
      return { stato: 201, corpo: { ...(await leggiUna(c, id)), nuova: true } };
    });
  }

  async function aggiorna({ id, corpo, email }) {
    idValido(R, id);
    const b = oggetto(corpo);
    const { colonne, scheda } = separa(b, { aggiorna: true });
    const c1 = (k) => (Object.hasOwn(b, k) ? testo(b, k) : null);
    const telefono = c1("telefono"), sito = c1("sito"), piva = c1("piva"), place = c1("place_id"), mail = c1("email");
    return scrivi(email, async (c) => {
      const v = (await c.query("select * from app.aziende where id = $1 for update", [id])).rows[0];
      if (!v) throw new ErroreApi(404, "non trovato");
      const n = await norme(c, { telefono: telefono ?? "", sito: sito ?? "", piva: piva ?? "" });
      const condivise = [];

      if (telefono !== null) {
        colonne.set("telefono", telefono);
        if (n.tel !== v.telefono_norm) {
          colonne.set("telefono_norm", n.tel);
          if (v.telefono_norm) await togliChiave(c, id, "telefono", v.telefono_norm);
          if (n.tel) {
            const altra = await chiaveDebole(c, id, "telefono", "telefono_norm", n.tel);
            if (altra) condivise.push(["lo stesso telefono di un'altra azienda", altra]);
          }
        }
      }
      if (sito !== null) {
        colonne.set("sito", sito);
        if (n.dom !== v.dominio) {
          colonne.set("dominio", n.dom);
          if (v.dominio) await togliChiave(c, id, "dominio", v.dominio);
          if (n.dom) {
            const altra = await chiaveDebole(c, id, "dominio", "dominio", n.dom);
            if (altra) condivise.push(["lo stesso sito di un'altra azienda", altra]);
          }
        }
      }
      if (piva !== null) {
        if (piva === v.piva) colonne.delete("piva");
        else {
          if (piva && !n.piva_ok) throw pivaNonValida();
          const nuova = piva ? n.piva : "";
          colonne.set("piva", nuova);
          if (nuova !== v.piva) {
            if (v.piva) await togliChiave(c, id, "piva", v.piva);
            if (nuova) await chiaveForte(c, id, "piva", "piva", nuova);
          }
        }
      }
      if (place !== null) {
        colonne.set("place_id", place || null);
        if (place && place !== v.place_id) await chiaveForte(c, id, "place_id", "place_id", place);
      }
      if (mail !== null) colonne.set("email", mail.toLowerCase());

      if (colonne.size) {
        const set = [...colonne.entries()];
        await c.query(`update app.aziende set ${set.map(([k], i) => `${q(k)} = $${i + 2}`).join(", ")}, "aggiornato" = now() where id = $1`,
          [id, ...set.map(([, x]) => x)]);
      }
      for (const [motivo, altra] of condivise) {
        await c.query(`update app.aziende a set unione = 'da-controllare',
          unione_motivo = case when a.unione_motivo = '' then $1 else a.unione_motivo end, aggiornato = now()
          where a.id = any($2::uuid[])`, [motivo, [id, altra]]);
      }
      await salvaScheda(c, id, scheda);
      return { stato: 200, corpo: await leggiUna(c, id) };
    });
  }

  async function scheda({ id, email }) {
    idValido(R, id);
    const riga = await conLaSessione(email, (c) => leggiUna(c, id));
    if (!riga) throw new ErroreApi(404, "non trovato");
    return { stato: 200, corpo: riga };
  }

  return async function aziende({ metodo, risorsa: nome, id, azione, cerca: parametri, corpo, email }) {
    if (nome !== "aziende") return null;
    const metodoSolo = (m) => { if (metodo !== m) throw new ErroreApi(405, "metodo non ammesso", "metodo"); };
    try {
      if (id === "verifica" && azione === undefined) { metodoSolo("POST"); senzaParametri(parametri); return await verifica({ corpo, email }); }
      if (id === undefined && metodo === "POST") { senzaParametri(parametri); return await crea({ corpo, email }); }
      if (id !== undefined && azione === "scheda") { metodoSolo("GET"); senzaParametri(parametri); return await scheda({ id, email }); }
      if (id !== undefined && azione === undefined && (metodo === "PUT" || metodo === "PATCH")) {
        senzaParametri(parametri);
        return await aggiorna({ id, corpo, email });
      }
      return null;
    } catch (e) {
      if (e instanceof Doppione) return { stato: e.stato, corpo: { error: { message: e.message, code: e.code, chiave: e.chiave, azienda_id: e.azienda_id } } };
      throw e;
    }
  };
}
