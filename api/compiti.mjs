import { daDove, fonteDi, lateralContatto, lateralUltima, ULTIMA } from "./elenchi.mjs";
import { ErroreApi, pertinente } from "./regole.mjs";
import { legamiStatoAzienda, statoAzienda, statoTesto } from "./stato.mjs";

const PASSO = 50;
const MAX_GRUPPO = 2000;
const MAX_COLLEGABILI = 6;
const GRUPPI = ["scaduti", "oggi", "domani", "settimana", "dopo", "senza", "fatti"];
const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

const LEGAMI = `left join crm.trattative t on t.id = x.trattativa_id
  left join crm.persone pe on pe.id = coalesce(t.persona_id, x.persona_id)
  left join app.aziende az on az.id = coalesce(t.azienda_id, pe.azienda_id, x.azienda_id)`;

const CHI_FA = "coalesce(nullif(x.assegnato_a, ''), x.creato_da)";

const LEGAME = `case when x.trattativa_id is not null then 'trattativa' when x.persona_id is not null then 'persona' else 'azienda' end`;

const ORDINI = {
  testo: "lower(x.testo)",
  scadenza: "x.scadenza",
  assegnato: CHI_FA,
  creato_da: "x.creato_da",
  quando: "x.quando",
  fatto_il: "x.fatto_il",
  legame: LEGAME,
  azienda: "lower(az.nome)",
  persona: "lower(pe.nome)",
  trattativa: "(select fl.ordine from app.fasi_lead fl where fl.id = t.fase_id)",
  trattativa_prossimo: "t.prossimo_il",
  azienda_stato: statoTesto.aziende("az"),
  azienda_da_dove: `coalesce((select concat_ws(' ', c.fonte, c.inserzione) from app.contatti c where c.id = t.contatto_id), ${fonteDi("azienda_id", "az.id")}, nullif(pe.fonte, ''))`,
  azienda_ultima: `greatest((select max(y.quando) from crm.attivita y where y.azienda_id = az.id),
    (select max(y.quando) from crm.attivita y where y.persona_id = pe.id),
    (select max(y.quando) from crm.attivita y where y.trattativa_id = t.id))`,
};

const EXTRA = {
  stato: { colonna: statoAzienda("az"), legami: legamiStatoAzienda("az") },
  da_dove: { colonna: daDove("az", "coalesce(k.fonte, nullif(pe.fonte, ''))"), legami: lateralContatto("azienda_id", "az.id") },
  ultima: {
    colonna: ULTIMA,
    legami: lateralUltima(["crm.attivita y where y.azienda_id = az.id", "crm.attivita y where y.persona_id = pe.id", "crm.attivita y where y.trattativa_id = t.id"]),
  },
};

const fuoriLista = (nome) => new ErroreApi(400, `${nome}: valore fuori lista`, "parametro");

function giornoDa(cerca) {
  const g = cerca.get("giorno");
  if (g === null) return null;
  if (!GIORNO.test(g) || Number.isNaN(Date.parse(`${g}T12:00:00Z`))) throw new ErroreApi(400, "giorno: serve AAAA-MM-GG", "valore");
  return g;
}

function cercato(cerca) {
  const q = cerca.get("q");
  if (q === null || !q.trim()) return null;
  if (q.length > 200) throw new ErroreApi(400, "q: testo fino a 200 caratteri", "parametro");
  return `%${q.trim().replace(/[\\%_]/g, (c) => "\\" + c)}%`;
}

function limitiDa(cerca) {
  const v = cerca.get("limiti");
  if (v === null) return {};
  let l;
  try { l = JSON.parse(v); } catch { throw new ErroreApi(400, "limiti: serve JSON", "parametro"); }
  if (!l || typeof l !== "object" || Array.isArray(l)) throw new ErroreApi(400, "limiti: serve un oggetto", "parametro");
  for (const [k, n] of Object.entries(l)) {
    if (!GRUPPI.includes(k)) throw fuoriLista("limiti");
    if (!Number.isInteger(n) || n < 1 || n > MAX_GRUPPO) throw new ErroreApi(400, `limiti: da 1 a ${MAX_GRUPPO}`, "valore");
  }
  return l;
}

function extraDa(cerca) {
  const v = cerca.get("extra");
  if (!v) return [];
  const nomi = [...new Set(v.split(","))];
  if (!nomi.every((n) => Object.hasOwn(EXTRA, n))) throw fuoriLista("extra");
  return nomi;
}

export function creaCompiti({ conLaSessione }) {
  async function elenco(cerca, email) {
    const di = cerca.get("di") ?? "me";
    if (di !== "me" && di !== "team") throw fuoriLista("di");
    const stato = cerca.get("stato") ?? "da_fare";
    if (stato !== "da_fare" && stato !== "fatti") throw fuoriLista("stato");
    const fatti = stato === "fatti";
    const ordine = cerca.get("ordine") ?? (fatti ? "fatto_il" : "scadenza");
    if (!Object.hasOwn(ORDINI, ordine)) throw fuoriLista("ordine");
    const dir = cerca.get("dir") ?? (fatti ? "desc" : "asc");
    if (dir !== "asc" && dir !== "desc") throw fuoriLista("dir");
    const extra = extraDa(cerca).map((n) => EXTRA[n]);
    const io = di === "me" ? String(email).toLowerCase() : null;
    const params = [giornoDa(cerca), io, cercato(cerca), JSON.stringify(limitiDa(cerca))];

    const sql = `
      with g as (select coalesce($1::date, (now() at time zone 'Europe/Rome')::date) as d),
      b as materialized (select d::timestamp at time zone 'Europe/Rome' as oggi,
          (d + 1)::timestamp at time zone 'Europe/Rome' as domani,
          (d + 2)::timestamp at time zone 'Europe/Rome' as dopodomani,
          (d + (8 - extract(isodow from d))::int)::timestamp at time zone 'Europe/Rome' as lunedi
        from g),
      base as (
        select x.id, ${ORDINI[ordine]} as o,
          ${fatti ? `'fatti'` : `case when x.scadenza is null then 'senza'
            when x.scadenza < b.oggi then 'scaduti'
            when x.scadenza < b.domani then 'oggi'
            when x.scadenza < b.dopodomani then 'domani'
            when x.scadenza < b.lunedi then 'settimana'
            else 'dopo' end`} as gruppo
        from crm.attivita x cross join b
        ${LEGAMI}
        where x.tipo = 'compito' and x.fatto_il is ${fatti ? "not null" : "null"}
          and ($2::text is null or ${CHI_FA} = $2 or coalesce(${CHI_FA}, '') = '')
          and ($3::text is null or x.testo ilike $3 or az.nome ilike $3 or pe.nome ilike $3 or pe.telefono ilike $3 or az.telefono ilike $3)
      ),
      numerate as materialized (
        select id, gruppo, count(*) over (partition by gruppo)::int as n_gruppo,
          row_number() over (partition by gruppo order by o ${dir} nulls last, id) as n
        from base
      )
      select x.id, x.testo, x.scadenza, x.fatto_il, x.quando, x.creato_da, x.assegnato_a, ${CHI_FA} as assegnato, nm.gruppo, nm.n_gruppo, ${LEGAME} as legame,
        az.id as azienda_id, az.nome as azienda_nome, az.telefono as azienda_telefono,
        pe.id as persona_id, pe.nome as persona_nome, pe.telefono as persona_telefono,
        t.id as trattativa_id, t.fase_id, f.nome as fase_nome, f.percorso_nome, t.archiviata_il as trattativa_archiviata,
        t.prossimo_passo, t.prossimo_il
        ${extra.map((e) => `, ${e.colonna}`).join("")}
      from numerate nm join crm.attivita x on x.id = nm.id
      ${LEGAMI}
      left join crm.fasi f on f.id = t.fase_id
      ${extra.map((e) => e.legami).join("\n")}
      where nm.n <= coalesce(($4::jsonb ->> nm.gruppo)::int, ${PASSO})
      order by nm.gruppo, nm.n`;

    const { rows } = await conLaSessione(email, (c) => c.query(sql, params));
    const perGruppo = new Map();
    for (const { gruppo, n_gruppo, ...riga } of rows) {
      if (!perGruppo.has(gruppo)) perGruppo.set(gruppo, { chiave: gruppo, n: n_gruppo, righe: [] });
      perGruppo.get(gruppo).righe.push(riga);
    }
    const gruppi = GRUPPI.flatMap((k) => perGruppo.get(k) ?? []);
    const conta = (k) => perGruppo.get(k)?.n ?? 0;
    return { stato: 200, corpo: { totale: gruppi.reduce((s, x) => s + x.n, 0), entro_oggi: conta("scaduti") + conta("oggi"), gruppi } };
  }

  async function dovuti(cerca, email) {
    const { rows } = await conLaSessione(email, (c) => c.query(
      `select count(*)::int as n from crm.attivita x
        where x.tipo = 'compito' and x.fatto_il is null
          and x.scadenza < (coalesce($1::date, (now() at time zone 'Europe/Rome')::date) + 1)::timestamp at time zone 'Europe/Rome'
          and (${CHI_FA} = $2 or coalesce(${CHI_FA}, '') = '')`,
      [giornoDa(cerca), String(email).toLowerCase()]));
    return { stato: 200, corpo: { n: rows[0].n } };
  }

  async function collegabili(cerca, email) {
    const q = cercato(cerca);
    if (!q) return { stato: 200, corpo: { righe: [] } };
    const { rows } = await conLaSessione(email, (c) => c.query(
      `(select 'azienda' as tipo, a.id, a.nome, concat_ws(' · ', a.comune, a.categoria) as dettaglio,
               a.id as azienda_id, null::uuid as persona_id, null::uuid as trattativa_id
          from app.aziende a
         where a.nome ilike $1 and ${pertinente("a")}
         order by a.nome, a.id limit ${MAX_COLLEGABILI})
       union all
       (select 'persona', p.id, p.nome, concat_ws(' · ', nullif(p.ruolo, ''), az.nome), p.azienda_id, p.id, null::uuid
          from crm.persone p left join app.aziende az on az.id = p.azienda_id
         where p.archiviata_il is null and (p.nome ilike $1 or p.telefono ilike $1 or p.email ilike $1)
         order by p.nome, p.id limit ${MAX_COLLEGABILI})
       union all
       (select 'trattativa', t.id, coalesce(az.nome, pe.nome, f.percorso_nome, t.percorso),
               concat_ws(' · ', f.nome, f.percorso_nome, pe.nome, nullif(t.prossimo_passo, '')),
               coalesce(t.azienda_id, pe.azienda_id), t.persona_id, t.id
          from crm.trattative t
          left join crm.persone pe on pe.id = t.persona_id
          left join app.aziende az on az.id = coalesce(t.azienda_id, pe.azienda_id)
          left join crm.fasi f on f.id = t.fase_id
         where t.archiviata_il is null and (az.nome ilike $1 or pe.nome ilike $1 or t.prossimo_passo ilike $1)
         order by t.mossa_il desc nulls last, t.id limit ${MAX_COLLEGABILI})`,
      [q]));
    return { stato: 200, corpo: { righe: rows } };
  }

  return async function compiti({ metodo, risorsa, id, azione, cerca, email }) {
    if (risorsa !== "compiti") return null;
    if (azione !== undefined) throw new ErroreApi(404, "non trovato");
    if (metodo !== "GET") throw new ErroreApi(405, "metodo non ammesso", "metodo");
    if (id === "elenco") return elenco(cerca, email);
    if (id === "dovuti") return dovuti(cerca, email);
    if (id === "collegabili") return collegabili(cerca, email);
    throw new ErroreApi(404, "non trovato");
  };
}
