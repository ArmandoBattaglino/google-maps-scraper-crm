import { SOCIO_SQL } from "./db.mjs";
import { ErroreApi, FINESTRA, pertinente } from "./regole.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const VOCI = Object.freeze({
  freddo: { nome: "Liste a freddo", canale: "lista", metodo: "" },
  mano: { nome: "A mano", canale: "manuale", metodo: "" },
  passaparola: { nome: "Passaparola", canale: "passaparola", metodo: "" },
  evento: { nome: "Evento o incontro", canale: "manuale", metodo: "evento" },
});
const ORDINE_VOCI = Object.keys(VOCI);
const DA_CHI_MAX = 200;

export const voceDi = (o) => `case when ${o}.canale in ('maps', 'indeed', 'lista') then 'freddo' when ${o}.canale = 'passaparola' then 'passaparola'
    when ${o}.canale = 'manuale' and ${o}.metodo = 'evento' then 'evento' else 'mano' end`;
const CASE_NOME = (voce) => `case ${voce} ${Object.entries(VOCI).map(([k, v]) => `when '${k}' then '${v.nome}'`).join(" ")} end`;
export const nomeVoceDi = (o) => CASE_NOME(`(${voceDi(o)})`);
const postoVoceDi = (o) => `array_position(array[${ORDINE_VOCI.map((v) => `'${v}'`).join(", ")}], ${voceDi(o)})`;

const testoDi = (o) => `case when (${voceDi(o)}) = 'freddo' and ${o}.parola <> '' then concat_ws(' · ', ${o}.parola, nullif(coalesce(nullif(${o}.zona, ''), ${o}.luogo), ''))
    else concat_ws(' · ', ${nomeVoceDi(o)}, nullif(${o}.inserzione, ''), nullif(${o}.da_chi, '')) end`;

const prima = (az, cosa) => `(select ${cosa} from app.aziende_provenienze o where o.azienda_id = ${az} order by o.prima_vista, o.id limit 1)`;
export const voceOrigine = (az) => prima(az, nomeVoceDi("o"));
export const testoOrigine = (az) => prima(az, testoDi("o"));

export const arrivoJson = (az) => `(select jsonb_strip_nulls(jsonb_build_object('id', o.id, 'voce', ${voceDi("o")}, 'quando', o.prima_vista,
      'campagna', nullif(o.campagna, ''), 'inserzione', nullif(o.inserzione, ''), 'gruppo', nullif(o.gruppo_inserzioni, ''), 'piattaforma', nullif(o.piattaforma, ''),
      'parola', nullif(o.parola, ''), 'luogo', nullif(o.luogo, ''), 'zona', nullif(o.zona, ''), 'da_chi', nullif(o.da_chi, ''),
      'ritorni', nullif((select count(*)::int from app.aziende_provenienze r where r.azienda_id = o.azienda_id) - 1, 0)))
    from app.aziende_provenienze o
   where o.azienda_id = ${az} order by o.prima_vista, o.id limit 1)`;

const NON_PRIMA = (o) => `exists (select 1 from app.aziende_provenienze pp where pp.azienda_id = ${o}.azienda_id and (pp.prima_vista, pp.id) < (${o}.prima_vista, ${o}.id))`;

const ORDINI = {
  id: "o.id",
  azienda: "a.nome",
  persona: `(select pe.nome from crm.persone pe where pe.id = o.persona_id)`,
  trattativa: `(select f.ordine from crm.trattative t join crm.fasi f on f.id = t.fase_id where t.id = o.trattativa_id)`,
  tipo: `(${NON_PRIMA("o")})::int`,
  canale: postoVoceDi("o"),
  quando: "o.prima_vista",
  inserzione: "nullif(o.inserzione, '')",
  gruppo: "nullif(o.gruppo_inserzioni, '')",
  campagna: "nullif(o.campagna, '')",
  piattaforma: "nullif(o.piattaforma, '')",
  risposte: "jsonb_array_length(o.risposte_modulo)",
  parola: "nullif(o.parola, '')",
  zona: "nullif(coalesce(nullif(o.zona, ''), o.luogo), '')",
  metodo: "nullif(o.metodo, '')",
  volte: "o.volte",
};
const PARAMETRI = new Set(["_start", "_end", "_sort", "_order", "tipo", "voce", "azienda_id", "q", "gruppo"]);
const BASE = "from app.aziende_provenienze o join app.aziende a on a.id = o.azienda_id";

const RIGA = `o.id, o.azienda_id, a.nome as azienda_nome, coalesce(o.persona_id, t.persona_id) as persona_id, pe.nome as persona_nome, t.id as trattativa_id,
      t.fase_id, f.nome as fase_nome, f.tipo as fase_tipo, t.archiviata_il as trattativa_archiviata, not (${NON_PRIMA("o")}) as prima,
      ${voceDi("o")} as voce, o.prima_vista as quando, o.ultima_vista, o.volte, o.inserzione, o.campagna, o.gruppo_inserzioni as gruppo, o.piattaforma,
      o.parola, o.luogo, o.zona, o.fonte, o.metodo, o.da_chi, o.risposte_modulo, o.risposte,
      (select lf.nome from app.liste_freddo lf where lf.id = o.lista_id) as lista, a.dati ->> 'maps' as maps`;
const LEGAMI = `join app.aziende a on a.id = o.azienda_id
      left join lateral (select tt.id from crm.trattative tt where tt.azienda_id = o.azienda_id and tt.archiviata_il is null order by tt.creato desc, tt.id limit 1) viva on o.trattativa_id is null
      left join crm.trattative t on t.id = coalesce(o.trattativa_id, viva.id)
      left join crm.persone pe on pe.id = coalesce(o.persona_id, t.persona_id)
      left join crm.fasi f on f.id = t.fase_id`;

export async function scriviArrivo(c, { azienda_id, voce, da_chi = "", persona_id = null, trattativa_id = null }) {
  const v = VOCI[voce];
  return (await c.query(`insert into app.aziende_provenienze (azienda_id, canale, metodo, da_chi, persona_id, trattativa_id)
    values ($1, $2, $3, $4, $5, $6) returning id`, [azienda_id, v.canale, v.metodo, da_chi, persona_id, trattativa_id])).rows[0].id;
}

export function leggiVoce(corpo) {
  const voce = corpo.voce;
  if (typeof voce !== "string" || !Object.hasOwn(VOCI, voce)) throw new ErroreApi(400, `voce fuori lista: serve una di ${ORDINE_VOCI.join(", ")}`, "valore");
  const da_chi = corpo.da_chi === undefined || corpo.da_chi === null ? "" : corpo.da_chi;
  if (typeof da_chi !== "string" || da_chi.length > DA_CHI_MAX) throw new ErroreApi(400, `da_chi: testo fino a ${DA_CHI_MAX} caratteri`, "valore");
  if (voce === "passaparola" && !da_chi.trim()) throw new ErroreApi(400, "il passaparola vuole da chi", "valore");
  return { voce, da_chi: da_chi.trim() };
}

const uuidO = (v, nome) => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || !UUID.test(v)) throw new ErroreApi(400, `${nome}: serve un id`, "valore");
  return v;
};
const campiPost = new Set(["azienda_id", "voce", "da_chi", "persona_id", "trattativa_id"]);

function filtri(cerca, params, { conVoce = true } = {}) {
  for (const k of new Set(cerca.keys())) if (!PARAMETRI.has(k)) throw new ErroreApi(400, "parametro fuori lista", "parametro");
  const dove = [pertinente("a")];
  const tipo = cerca.get("tipo");
  if (tipo !== null && tipo !== "" && tipo !== "origini" && tipo !== "tutti") throw new ErroreApi(400, "tipo: origini o tutti", "valore");
  if (tipo === "origini") dove.push(`not (${NON_PRIMA("o")})`);
  const voci = cerca.getAll("voce").filter(Boolean);
  if (voci.some((v) => !Object.hasOwn(VOCI, v))) throw new ErroreApi(400, "voce fuori lista", "valore");
  if (conVoce && voci.length) { params.push(voci); dove.push(`(${voceDi("o")}) = any($${params.length}::text[])`); }
  const azienda = cerca.get("azienda_id");
  if (azienda) { params.push(uuidO(azienda, "azienda_id")); dove.push(`o.azienda_id = $${params.length}::uuid`); }
  const q = cerca.get("q");
  if (q && q.trim()) {
    if (q.length > 200) throw new ErroreApi(400, "q: testo fino a 200 caratteri", "parametro");
    params.push(`%${q.trim().replace(/[\\%_]/g, (x) => "\\" + x)}%`);
    const n = `$${params.length}`;
    dove.push(`(a.nome ilike ${n} or o.inserzione ilike ${n} or o.campagna ilike ${n} or o.gruppo_inserzioni ilike ${n} or o.parola ilike ${n} or o.zona ilike ${n} or o.da_chi ilike ${n})`);
  }
  return ` where ${dove.join(" and ")}`;
}

function intero(nome, v, dflt) {
  if (v === null || v === "") return dflt;
  if (!/^\d{1,9}$/.test(v)) throw new ErroreApi(400, `${nome}: serve un intero ≥ 0`, "parametro");
  return Number(v);
}

export function creaOrigini({ conLaSessione }) {
  const scrivi = (email, fn) => conLaSessione(email, async (c) => {
    if (!(await c.query(SOCIO_SQL)).rows[0].ok) throw new ErroreApi(403, "solo gli utenti scrivono nel CRM", "socio");
    return fn(c);
  });

  async function elenco(cerca, email) {
    const params = [];
    const where = filtri(cerca, params);
    const start = intero("_start", cerca.get("_start"), 0), end = intero("_end", cerca.get("_end"), start + 25);
    if (end <= start || end - start > FINESTRA) throw new ErroreApi(400, `finestra fuori lista (1-${FINESTRA} righe)`, "parametro");
    const campo = cerca.get("_sort") || "arrivi";
    if (campo !== "arrivi" && !Object.hasOwn(ORDINI, campo)) throw new ErroreApi(400, "ordine fuori lista", "parametro");
    const dir = String(cerca.get("_order") || "DESC").toUpperCase() === "ASC" ? "asc" : "desc";
    const primaDi = cerca.get("gruppo") === "voce" ? `${postoVoceDi("o")} asc, ` : "";
    const ordine = campo === "arrivi"
      ? `min(o.prima_vista) over (partition by o.azienda_id) ${dir}, o.azienda_id, o.prima_vista asc, o.id asc`
      : `${ORDINI[campo]} ${dir} nulls last, o.azienda_id, o.prima_vista asc, o.id asc`;
    const sql = `with pagina as materialized (select o.id ${BASE}${where} order by ${primaDi}${ordine} limit ${end - start} offset ${start}),
      numerata as (select id, row_number() over () as n from pagina)
      select ${RIGA} from numerata n join app.aziende_provenienze o on o.id = n.id ${LEGAMI} order by n.n`;
    const { totale, righe } = await conLaSessione(email, async (c) => {
      const conto = (await c.query(`select count(*)::bigint as n ${BASE}${where}`, params)).rows[0].n;
      return { totale: Number(conto), righe: (await c.query(sql, params)).rows };
    });
    const fine = righe.length ? `${start}-${start + righe.length - 1}` : "*";
    return { stato: 200, corpo: righe, intestazioni: { "X-Total-Count": String(totale), "Content-Range": `origini ${fine}/${totale}`,
      "Access-Control-Expose-Headers": "X-Total-Count, Content-Range" } };
  }

  async function conteggi(cerca, email) {
    const params = [];
    const where = filtri(cerca, params, { conVoce: false });
    const { rows } = await conLaSessione(email, (c) => c.query(`select ${voceDi("o")} as voce, count(*)::int as n ${BASE}${where} group by 1`, params));
    return { stato: 200, corpo: { totale: rows.reduce((s, r) => s + r.n, 0), voci: Object.fromEntries(rows.map((r) => [r.voce, r.n])) } };
  }

  async function una(id, email) {
    if (!UUID.test(id)) throw new ErroreApi(400, "id non valido", "valore");
    const r = await conLaSessione(email, async (c) => (await c.query(`select ${RIGA}, o.contatto_id, o.raccolta_id, o.lista_id,
        (select l.nome from app.liste_freddo l where l.id = o.lista_id) as lista_nome,
        case when k.id is null then null else jsonb_build_object('nome', k.nome, 'telefono', k.telefono, 'email', k.email, 'azienda', k.azienda) end as contatto
      from app.aziende_provenienze o ${LEGAMI} left join app.contatti k on k.id = o.contatto_id where o.id = $1`, [id])).rows[0]);
    if (!r) throw new ErroreApi(404, "non trovato");
    return { stato: 200, corpo: r };
  }

  async function nuovo(corpo, email) {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new ErroreApi(400, "il corpo è un oggetto", "valore");
    if (Object.keys(corpo).some((k) => !campiPost.has(k))) throw new ErroreApi(400, "campo fuori lista", "colonna");
    const azienda_id = uuidO(corpo.azienda_id, "azienda_id");
    if (!azienda_id) throw new ErroreApi(400, "manca l'azienda", "valore");
    const { voce, da_chi } = leggiVoce(corpo);
    const persona_id = uuidO(corpo.persona_id, "persona_id"), trattativa_id = uuidO(corpo.trattativa_id, "trattativa_id");
    return scrivi(email, async (c) => {
      const id = await scriviArrivo(c, { azienda_id, voce, da_chi, persona_id, trattativa_id });
      return { stato: 201, corpo: { id, azienda_id, voce, da_chi } };
    });
  }

  return async function origini({ metodo, risorsa, id, azione, cerca, corpo, email }) {
    if (risorsa !== "origini") return null;
    if (azione !== undefined) throw new ErroreApi(404, "non trovato");
    if (id === undefined) {
      if (metodo === "POST") return nuovo(corpo, email);
      if (metodo === "GET") return elenco(cerca, email);
      throw new ErroreApi(405, "metodo non ammesso", "metodo");
    }
    if (metodo !== "GET") throw new ErroreApi(405, "metodo non ammesso", "metodo");
    if (id === "elenco") return elenco(cerca, email);
    if (id === "conteggi") return conteggi(cerca, email);
    return una(id, email);
  };
}
