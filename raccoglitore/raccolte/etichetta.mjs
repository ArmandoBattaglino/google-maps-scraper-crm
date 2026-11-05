const norma = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();

export const NON_AZIENDE = Object.freeze([
  /^fermata\b/,
  /^stazione (ferroviaria|dei treni|della metropolitana|metropolitana|degli autobus|dei bus|dell'autobus|autobus|del tram|di transito)\b/,
  /^(stazione|punto|colonnina) di ricarica\b/,
  /^colonnina\b.*\bricarica\b/,
  /^(area di )?parcheggio\b/,
]);

export const NON_AZIENDA = "non-azienda", PERTINENTE = "pertinente";

export function etichettaDi(categorie) {
  const c = (Array.isArray(categorie) ? categorie : [categorie]).map(norma).filter(Boolean);
  return c.length && c.every((x) => NON_AZIENDE.some((r) => r.test(x))) ? NON_AZIENDA : PERTINENTE;
}
