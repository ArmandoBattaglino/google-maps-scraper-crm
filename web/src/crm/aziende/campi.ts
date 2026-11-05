export const CAMPI_SCRIVIBILI = [
  "nome",
  "telefono",
  "sito",
  "piva",
  "email",
  "indirizzo",
  "comune",
  "categoria",
  "referente",
  "esito",
  "richiamare_il",
  "note",
  "voce",
  "da_chi",
] as const;

export const ESITI = [
  { id: "da-chiamare", name: "Da chiamare" },
  { id: "non-risponde", name: "Non risponde" },
  { id: "richiamare", name: "Da richiamare" },
  { id: "non-interessato", name: "Non interessato" },
  { id: "interessato", name: "Interessato" },
];

type Dati = Record<string, unknown>;

export const soloScrivibili = (dati: Dati): Dati => {
  const fuori: Dati = {};
  for (const campo of CAMPI_SCRIVIBILI) {
    if (!(campo in dati)) continue;
    const valore = dati[campo];
    fuori[campo] = campo === "richiamare_il" && !valore ? null : (valore ?? "");
  }
  return fuori;
};
