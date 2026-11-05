const RANGO = `case when tr.archiviata_il is not null then 3 when fs.tipo = 'aperta' then 0 when fs.tipo is null then 2 else 1 end`;
const ORDINE = `${RANGO}, tr.mossa_il desc nulls last, tr.id`;
const DA = `from crm.trattative tr left join app.fasi_lead fs on fs.id = tr.fase_id`;
const FASE = `coalesce(fs.nome, tr.fase_id)`;
const APERTE = `count(*) filter (where tr.archiviata_il is null and fs.tipo = 'aperta') over ()`;

export const dellaViva = (colonna, id, cosa) => `(select ${cosa} ${DA} where tr.${colonna} = ${id} and tr.archiviata_il is null order by ${ORDINE} limit 1)`;

const aParole = (e) => `case ${e} when 'da-chiamare' then 'Da chiamare' when 'non-risponde' then 'Non risponde'
  when 'richiamare' then 'Da richiamare' when 'non-interessato' then 'Non interessato' when 'interessato' then 'Interessato' else ${e} end`;

const faseDi = (colonna, id) => `(select ${FASE} ${DA} where tr.${colonna} = ${id} order by ${ORDINE} limit 1)`;
const testoAzienda = (id, esito) => `coalesce(${faseDi("azienda_id", id)}, ${aParole(esito)})`;

export const statoTesto = {
  aziende: (a) => testoAzienda(`${a}.id`, `${a}.esito`),
  persone: (p) => `coalesce(${faseDi("persona_id", `${p}.id`)},
    (select ${testoAzienda("az_.id", "az_.esito")} from app.aziende az_ where az_.id = ${p}.azienda_id))`,
};

const segniDi = (colonna, id) => `(select jsonb_build_object('archiviata', x.archiviata_il is not null, 'altre_aperte', greatest(x.aperte - 1, 0)) from (
    select tr.archiviata_il, ${APERTE} as aperte ${DA} where tr.${colonna} = ${id} order by ${ORDINE} limit 1) x)`;
export const statoSegni = {
  aziende: (a) => segniDi("azienda_id", `${a}.id`),
  persone: (p) => `coalesce(${segniDi("persona_id", `${p}.id`)}, ${segniDi("azienda_id", `${p}.azienda_id`)})`,
};

const lateral = (colonna, id, alias, solo = "") => `
  left join lateral (
    select tr.id, tr.archiviata_il, tr.valore, tr.avvio, tr.canone, tr.segue, tr.prossimo_passo, tr.prossimo_il, ${FASE} as fase, fs.tipo, fs.percorso_nome, ${APERTE} as aperte
      from crm.trattative tr left join crm.fasi fs on fs.id = tr.fase_id where tr.${colonna} = ${id}${solo} order by ${ORDINE} limit 1
  ) ${alias} on true`;

export const vivaSt = (c) => `case when st.archiviata_il is null then st.${c} end`;

export const prossimoSt = `case when st.archiviata_il is null and st.tipo = 'aperta' then st.prossimo_il end`;
const prossimoDi = (colonna, id) => `(select tr.prossimo_il ${DA} where tr.${colonna} = ${id} and tr.archiviata_il is null and fs.tipo = 'aperta' order by ${ORDINE} limit 1)`;
export const prossimoViva = prossimoDi;

export const segueDi = (colonna, id) => `(select tr.segue ${DA} where tr.${colonna} = ${id} order by ${ORDINE} limit 1)`;

const conTrattative = (id) => `exists (select 1 from crm.trattative tr where tr.azienda_id = ${id})`;
const CHIAMATA = `y.tipo = 'chiamata'`;
const ramoAzienda = (id) => `crm.attivita y where y.azienda_id = ${id} and ${CHIAMATA}`;
const ramoTrattative = (id) => `crm.attivita y join crm.trattative tu on tu.id = y.trattativa_id where tu.azienda_id = ${id} and ${CHIAMATA} and y.azienda_id is distinct from ${id}`;
const quanteChiamate = (id) => `((select count(*) from ${ramoAzienda(id)}) + (select count(*) from ${ramoTrattative(id)}))::int`;
const ultimaChiamata = (id, cosa) => `(select ch.${cosa} from (
    (select y.id, y.quando, y.creato_da from ${ramoAzienda(id)} order by y.quando desc, y.id desc limit 1) union all
    (select y.id, y.quando, y.creato_da from ${ramoTrattative(id)} order by y.quando desc, y.id desc limit 1)) ch order by ch.quando desc, ch.id desc limit 1)`;
const calcolo = (id, daTrattative, aFreddo) => `case when ${conTrattative(id)} then ${daTrattative} else ${aFreddo} end`;

export const calcolatiAzienda = (a, scheda) => {
  const id = `${a}.id`;
  return {
    tentativi: calcolo(id, quanteChiamate(id), `${a}.tentativi`),
    ultima_chiamata: calcolo(id, ultimaChiamata(id, "quando"), `${a}.ultima_chiamata`),
    chiamato_da: calcolo(id, ultimaChiamata(id, "creato_da"), `${a}.chiamato_da`),
    richiamare_il: calcolo(id, prossimoDi("azienda_id", id), `${a}.richiamare_il`),
    segue: `coalesce(${segueDi("azienda_id", id)}, ${scheda})`,
  };
};
export const segueSu = (a) => `(select jsonb_build_object('trattativa_id', x.id, 'altre_aperte', greatest(x.aperte - 1, 0)) from (
    select tr.id, count(*) over () as aperte ${DA} where tr.azienda_id = ${a}.id and tr.archiviata_il is null and fs.tipo = 'aperta' order by ${ORDINE} limit 1) x)`;

export const colonnaCalcolati = (a, scheda) => {
  const c = calcolatiAzienda(a, scheda);
  return `jsonb_build_object(${Object.entries(c).map(([k, v]) => `'${k}', ${v}`).join(", ")}) as calcolati`;
};
export const haTrattative = (a) => conTrattative(`${a}.id`);

export const legamiStatoAzienda = (a) => lateral("azienda_id", `${a}.id`, "st");
export const legamiStatoPersona = (p, az) => `${lateral("persona_id", `${p}.id`, "st")}${lateral("azienda_id", `${az}.id`, "sz", " and st.id is null")}`;

const daTrattativa = (x) => `jsonb_build_object('fase', ${x}.fase, 'tipo', ${x}.tipo, 'trattativa_id', ${x}.id, 'archiviata', ${x}.archiviata_il is not null, 'altre_aperte', greatest(${x}.aperte - 1, 0))`;
const aFreddo = (e) => `jsonb_build_object('fase', ${aParole(e)}, 'tipo', 'freddo', 'esito', ${e}, 'trattativa_id', null, 'archiviata', false, 'altre_aperte', 0)`;

export const statoAzienda = (a) => `case when st.id is not null then ${daTrattativa("st")} when ${a}.esito is not null then ${aFreddo(`${a}.esito`)} end as stato`;
export const statoPersona = (az) => `case when st.id is not null then ${daTrattativa("st")} when sz.id is not null then ${daTrattativa("sz")}
    when ${az}.esito is not null then ${aFreddo(`${az}.esito`)} end as stato`;
