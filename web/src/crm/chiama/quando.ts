import { oraDi, spostaGiorno } from "@/crm/attivita/tempo";
import { dataCorta, giornoRoma, istanteRoma } from "@/crm/tempo";

export interface DataRapida {
  chiave: string;
  etichetta: string;
  dettaglio: string;
  quando: string;
}

const MEZZORA = 30 * 60_000;
const DUE_ORE = 2 * 60 * 60_000;

export const dateRapide = (adesso: number): DataRapida[] => {
  const giorno = giornoRoma(new Date(adesso));
  const pomeriggio = istanteRoma(giorno, "15:00");
  const presto = Date.parse(pomeriggio) - adesso > MEZZORA;
  const fra2 = new Date(adesso + DUE_ORE).toISOString();
  const domani = istanteRoma(spostaGiorno(giorno, 1), "09:00");
  const settimana = istanteRoma(spostaGiorno(giorno, 7), "09:00");
  return [
    presto
      ? { chiave: "pomeriggio", etichetta: "Oggi pomeriggio", dettaglio: "alle 15:00", quando: pomeriggio }
      : { chiave: "pomeriggio", etichetta: "Fra due ore", dettaglio: `alle ${oraDi(fra2)}`, quando: fra2 },
    { chiave: "domani", etichetta: "Domani", dettaglio: "alle 9:00", quando: domani },
    { chiave: "settimana", etichetta: "Fra una settimana", dettaglio: dataCorta(settimana), quando: settimana },
  ];
};
