import { ULTIMA_NOTA } from "./nota.mjs";
import { arrivoJson, testoOrigine } from "./origini.mjs";
import { ErroreApi, regole } from "./regole.mjs";
import { calcolatiAzienda, colonnaCalcolati, dellaViva, legamiStatoAzienda, legamiStatoPersona, prossimoSt, prossimoViva, segueDi, statoAzienda, statoPersona, statoTesto, vivaSt } from "./stato.mjs";

const TESTO_MAX = 160;
const PROVENIENZE = 3;

const COLONNE_ATTIVITA = "y.quando, y.tipo, y.esito, y.esito_azienda, y.testo, y.fase, y.creato_da";
const FATTA = "not (y.tipo = 'compito' and y.fatto_il is null)";

export const lateralUltima = (rami) => `
  left join lateral (
    select x.*, coalesce(fa.nome, x.fase) as fase_nome from (
      ${rami.map((r) => `(select ${COLONNE_ATTIVITA} from ${r} and ${FATTA} order by y.quando desc limit 1)`).join(" union all ")}
    ) x left join crm.fasi fa on fa.id = x.fase
    order by x.quando desc limit 1
  ) ua on true`;
export const ULTIMA = `case when ua.quando is null then null else jsonb_build_object('quando', ua.quando, 'tipo', ua.tipo,
    'esito', coalesce(ua.esito_azienda, ua.esito), 'testo', left(ua.testo, ${TESTO_MAX}), 'fase', ua.fase_nome, 'chi', ua.creato_da) end as ultima`;

const tagDi = (oggetto, id) => `coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome, 'colore', g.colore) order by g.nome)
    from crm.tag_su s join crm.tag g on g.id = s.tag_id where s.oggetto = '${oggetto}' and s.oggetto_id = ${id}), '[]'::jsonb) as tag`;

export const lateralContatto = (colonna, id) => `
  left join lateral (
    select c.fonte, c.campagna, c.inserzione, c.gruppo_inserzioni, c.piattaforma
      from crm.trattative t join app.contatti c on c.id = t.contatto_id
     where t.${colonna} = ${id}
     order by t.creato, t.id limit 1
  ) k on true`;

const listaDi = (azienda) => `(select l.nome from app.liste_aziende la join app.liste_freddo l on l.id = la.lista_id
     where la.azienda_id = ${azienda} order by la.creato, la.id limit 1)`;

const provenienze = (azienda) => `(select jsonb_agg(to_jsonb(x) order by x.ultima_vista desc) from (
      select pv.parola, pv.luogo, pv.zona, pv.fonte, pv.metodo, pv.prima_vista, pv.ultima_vista, pv.volte, pv.raccolta_id, pv.lista_id
        from app.aziende_provenienze pv where pv.azienda_id = ${azienda} order by pv.ultima_vista desc, pv.id limit ${PROVENIENZE}) x)`;

export const daDove = (az, fonte = "k.fonte") => `jsonb_strip_nulls(jsonb_build_object(
    'arrivo', ${arrivoJson(`${az}.id`)},
    'fonte', nullif(${fonte}, ''), 'campagna', nullif(k.campagna, ''), 'inserzione', nullif(k.inserzione, ''),
    'gruppo', nullif(k.gruppo_inserzioni, ''), 'piattaforma', nullif(k.piattaforma, ''),
    'lista', ${listaDi(`${az}.id`)}, 'raccolta', ${az}.dati ->> 'fonte', 'origine', ${az}.dati ->> 'origine',
    'maps', case when coalesce(${az}.place_id, '') <> '' then true end,
    'provenienze', ${provenienze(`${az}.id`)},
    'ricerche', nullif((select count(*)::int from app.aziende_provenienze pv where pv.azienda_id = ${az}.id), 0))) as da_dove`;

const dellaTrattativa = (colonna, id, valore) => dellaViva(colonna, id, `tr.${valore}`);
const primoTag = (oggetto, id) => `(select min(g.nome) from crm.tag_su s join crm.tag g on g.id = s.tag_id where s.oggetto = '${oggetto}' and s.oggetto_id = ${id})`;
export const fonteDi = (colonna, id) => `(select concat_ws(' ', c.fonte, c.inserzione) from crm.trattative tr join app.contatti c on c.id = tr.contatto_id
    where tr.${colonna} = ${id} order by tr.creato, tr.id limit 1)`;
const dellAzienda = (id, c) => `(select z.${c} from app.aziende z where z.id = ${id})`;
const dellaPersona = (id, c) => `(select z.${c} from crm.persone z where z.id = ${id})`;

const CALCOLATI = calcolatiAzienda("a", "(select s.segue from crm.schede_aziende s where s.azienda_id = a.id)");
const ORDINI = {
  aziende: {
    tentativi: CALCOLATI.tentativi,
    ultima_chiamata: CALCOLATI.ultima_chiamata,
    chiamato_da: CALCOLATI.chiamato_da,
    richiamare_il: CALCOLATI.richiamare_il,
    stato: statoTesto.aziende("a"),
    persone: `(select min(p.nome) from crm.persone p where p.azienda_id = a.id and p.archiviata_il is null)`,
    trattative: `(select count(*) from crm.trattative tr where tr.azienda_id = a.id)`,
    segue: CALCOLATI.segue,
    da_dove: testoOrigine("a.id"),
    ultima: `greatest((select max(x.quando) from crm.attivita x where x.azienda_id = a.id),
      (select max(x.quando) from crm.attivita x join crm.trattative tr on tr.id = x.trattativa_id where tr.azienda_id = a.id))`,
    ultima_nota: `(${ULTIMA_NOTA.aziende("a.id")})`,
    tag: primoTag("azienda", "a.id"),
    persona_ruolo: `(select p.ruolo from crm.persone p where p.azienda_id = a.id and p.archiviata_il is null order by p.creato, p.id limit 1)`,
    persona_telefono: `(select p.telefono from crm.persone p where p.azienda_id = a.id and p.archiviata_il is null order by p.creato, p.id limit 1)`,
    persona_email: `(select p.email from crm.persone p where p.azienda_id = a.id and p.archiviata_il is null order by p.creato, p.id limit 1)`,
    trattativa_valore: dellaTrattativa("azienda_id", "a.id", "valore"),
    trattativa_passo: dellaTrattativa("azienda_id", "a.id", "prossimo_passo"),
    trattativa_il: prossimoViva("azienda_id", "a.id"),
  },
  persone: {
    azienda: dellAzienda("p.azienda_id", "nome"),
    stato: statoTesto.persone("p"),
    trattativa: dellaViva("persona_id", "p.id", "fs.nome"),
    segue: `coalesce(${segueDi("persona_id", "p.id")}, ${segueDi("azienda_id", "p.azienda_id")}, (select s.segue from crm.schede_aziende s where s.azienda_id = p.azienda_id))`,
    da_dove: `coalesce(${testoOrigine("p.azienda_id")}, nullif(p.fonte, ''))`,
    ultima: `(select max(x.quando) from crm.attivita x where x.persona_id = p.id)`,
    ultima_nota: `(${ULTIMA_NOTA.persone("p.id")})`,
    valore: dellaTrattativa("persona_id", "p.id", "valore"),
    tag: primoTag("persona", "p.id"),
    azienda_telefono: dellAzienda("p.azienda_id", "telefono"),
    azienda_sito: dellAzienda("p.azienda_id", "sito"),
    azienda_comune: dellAzienda("p.azienda_id", "comune"),
    azienda_categoria: dellAzienda("p.azienda_id", "categoria"),
    trattativa_passo: dellaTrattativa("persona_id", "p.id", "prossimo_passo"),
    trattativa_il: prossimoViva("persona_id", "p.id"),
  },
  trattative: {
    azienda: dellAzienda("t.azienda_id", "nome"),
    persona: dellaPersona("t.persona_id", "nome"),
    fase: `(select f.ordine from crm.fasi f where f.id = t.fase_id)`,
    da_dove: testoOrigine("t.azienda_id"),
    ultima: `(select max(x.quando) from crm.attivita x where x.trattativa_id = t.id)`,
    ultima_nota: `(${ULTIMA_NOTA.trattative("t.id")})`,
    tag: primoTag("trattativa", "t.id"),
    azienda_telefono: dellAzienda("t.azienda_id", "telefono"),
    azienda_sito: dellAzienda("t.azienda_id", "sito"),
    azienda_comune: dellAzienda("t.azienda_id", "comune"),
    azienda_categoria: dellAzienda("t.azienda_id", "categoria"),
    persona_ruolo: dellaPersona("t.persona_id", "ruolo"),
    persona_telefono: dellaPersona("t.persona_id", "telefono"),
    persona_email: dellaPersona("t.persona_id", "email"),
  },
};

function ordineCalcolato(nome, parametri) {
  const copia = new URLSearchParams(parametri);
  let campo = copia.get("_sort"), dir = copia.get("_order");
  if (copia.has("sort")) {
    try { [campo, dir] = JSON.parse(copia.get("sort")); } catch { return { copia: parametri, ordine: null }; }
  }
  if (typeof campo !== "string" || !Object.hasOwn(ORDINI[nome], campo)) return { copia: parametri, ordine: null };
  copia.delete("_sort"); copia.delete("_order"); copia.delete("sort");
  return { copia, ordine: `${ORDINI[nome][campo]} ${String(dir).toUpperCase() === "DESC" ? "desc" : "asc"} nulls last, id asc` };
}

const ELENCHI = {
  aziende: {
    alias: "a",
    colonne: `a.*, s.segue, coalesce(s.campi, '{}'::jsonb) as campi, ${statoAzienda("a")}, ${colonnaCalcolati("a", "s.segue")}, co.aperte as trattative_aperte, co.totali as trattative_totali, co.cliente,
      greatest((select max(x.quando) from crm.attivita x where x.azienda_id = a.id),
               (select max(x.quando) from crm.attivita x join crm.trattative t on t.id = x.trattativa_id where t.azienda_id = a.id)) as ultima_attivita,
      (select coalesce(jsonb_agg(jsonb_build_object('id', y.id, 'nome', y.nome) order by y.nome, y.id), '[]'::jsonb)
         from (select p.id, p.nome from crm.persone p where p.azienda_id = a.id and p.archiviata_il is null order by p.nome, p.id limit 3) y) as persone,
      (select count(*)::int from crm.persone p where p.azienda_id = a.id and p.archiviata_il is null) as persone_totali,
      pr.id as persona_id, pr.nome as persona_nome, pr.ruolo as persona_ruolo, pr.telefono as persona_telefono, pr.email as persona_email,
      ${vivaSt("avvio")} as trattativa_avvio, ${vivaSt("canone")} as trattativa_canone, ${vivaSt("valore")} as trattativa_valore, ${vivaSt("prossimo_passo")} as trattativa_passo, ${prossimoSt} as trattativa_il,
      ${daDove("a")}, ${ULTIMA}, ${ULTIMA_NOTA.aziende("a.id")} as ultima_nota, ${tagDi("azienda", "a.id")}`,
    legami: `left join crm.schede_aziende s on s.azienda_id = a.id
      left join lateral (select p.id, p.nome, p.ruolo, p.telefono, p.email from crm.persone p
        where p.azienda_id = a.id and p.archiviata_il is null order by p.creato, p.id limit 1) pr on true
      ${legamiStatoAzienda("a")}
      left join lateral (
        select count(*) filter (where f.tipo = 'aperta' and t.archiviata_il is null)::int as aperte, count(*)::int as totali,
               coalesce(bool_or(f.tipo = 'cliente' and t.archiviata_il is null), false) as cliente
          from crm.trattative t left join crm.fasi f on f.id = t.fase_id where t.azienda_id = a.id
      ) co on true
      ${lateralContatto("azienda_id", "a.id")}
      ${lateralUltima(["crm.attivita y where y.azienda_id = a.id", "crm.attivita y join crm.trattative tu on tu.id = y.trattativa_id where tu.azienda_id = a.id"])}`,
  },
  persone: {
    alias: "p",
    colonne: `p.*, az.nome as azienda_nome, az.telefono as azienda_telefono, az.sito as azienda_sito,
      az.comune as azienda_comune, az.categoria as azienda_categoria, ${vivaSt("id")} as trattativa_id, ${vivaSt("tipo")} as trattativa_tipo, ${vivaSt("avvio")} as trattativa_avvio, ${vivaSt("canone")} as trattativa_canone, ${vivaSt("prossimo_passo")} as trattativa_passo, ${prossimoSt} as trattativa_il, coalesce(st.segue, sz.segue, sa.segue) as segue, ${statoPersona("az")}, ${vivaSt("valore")} as valore, st.percorso_nome,
      (select count(*)::int from crm.trattative t where t.persona_id = p.id) as trattative_totali,
      ${daDove("az", "coalesce(k.fonte, p.fonte)")}, ${ULTIMA}, ${ULTIMA_NOTA.persone("p.id")} as ultima_nota, ${tagDi("persona", "p.id")}`,
    legami: `left join app.aziende az on az.id = p.azienda_id
      left join crm.schede_aziende sa on sa.azienda_id = p.azienda_id
      ${legamiStatoPersona("p", "az")}
      ${lateralContatto("persona_id", "p.id")}
      ${lateralUltima(["crm.attivita y where y.persona_id = p.id"])}`,
  },
  trattative: {
    alias: "t",
    colonne: `t.*, az.nome as azienda_nome, pe.nome as persona_nome, f.percorso_nome,
      az.telefono as azienda_telefono, az.sito as azienda_sito, az.comune as azienda_comune, az.categoria as azienda_categoria,
      pe.ruolo as persona_ruolo, pe.telefono as persona_telefono, pe.email as persona_email,
      ${daDove("az")}, ${ULTIMA}, ${ULTIMA_NOTA.trattative("t.id")} as ultima_nota, ${tagDi("trattativa", "t.id")}`,
    legami: `left join app.aziende az on az.id = t.azienda_id
      left join crm.persone pe on pe.id = t.persona_id
      left join crm.fasi f on f.id = t.fase_id
      left join app.contatti k on k.id = t.contatto_id
      ${lateralUltima(["crm.attivita y where y.trattativa_id = t.id"])}`,
  },
};

export function creaElenchi({ conLaSessione, catalogo }) {
  const { risorsa, leggiElenco } = regole(catalogo);

  async function elenco(nome, parametri, email) {
    const R = risorsa(nome);
    const E = ELENCHI[nome];
    const params = [];
    const { copia, ordine } = ordineCalcolato(nome, parametri);
    const { where, order, start, end } = leggiElenco(R, copia, params);
    const sql = `with pagina as materialized (select ${E.alias}."id" from ${R.tab} as ${E.alias}${where}${ordine ? ` order by ${ordine}` : order} limit ${end - start} offset ${start}),
      numerata as (select id, row_number() over () as n from pagina)
      select ${E.colonne} from numerata n join ${R.tab} ${E.alias} on ${E.alias}.id = n.id ${E.legami} order by n.n`;
    const { totale, righe } = await conLaSessione(email, async (c) => {
      const conto = (await c.query(`select count(*)::bigint as n from ${R.tab}${where}`, params)).rows[0].n;
      return { totale: Number(conto), righe: (await c.query(sql, params)).rows };
    });
    const fine = righe.length ? `${start}-${start + righe.length - 1}` : "*";
    return { stato: 200, corpo: righe, intestazioni: { "X-Total-Count": String(totale), "Content-Range": `${nome} ${fine}/${totale}`,
      "Access-Control-Expose-Headers": "X-Total-Count, Content-Range" } };
  }

  return async function elenchi({ metodo, risorsa: nome, id, azione, cerca, email }) {
    if (id !== "elenco" || azione !== undefined || !Object.hasOwn(ELENCHI, nome)) return null;
    if (metodo !== "GET") throw new ErroreApi(405, "metodo non ammesso", "metodo");
    return elenco(nome, cerca, email);
  };
}
