const DI_PERSONA = `n.tipo = 'nota' and n.creato_da like '%@%' and btrim(n.testo) <> ''`;
const PIU_RECENTE = "order by n.quando desc, n.id desc limit 1";

export const ULTIMA_NOTA = Object.freeze({
  trattative: (id) => `(select n.testo from crm.attivita n where n.trattativa_id = ${id} and ${DI_PERSONA} ${PIU_RECENTE})`,
  persone: (id) => `(select n.testo from crm.attivita n where n.persona_id = ${id} and ${DI_PERSONA} ${PIU_RECENTE})`,
  aziende: (id) => `(select x.testo from (
      (select n.testo, n.quando, n.id from crm.attivita n where n.azienda_id = ${id} and ${DI_PERSONA} ${PIU_RECENTE})
      union all
      (select n.testo, n.quando, n.id from crm.attivita n join crm.trattative tn on tn.id = n.trattativa_id
        where tn.azienda_id = ${id} and ${DI_PERSONA} ${PIU_RECENTE})
    ) x order by x.quando desc, x.id desc limit 1)`,
});
