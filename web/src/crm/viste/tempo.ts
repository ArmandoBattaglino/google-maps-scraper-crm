import { giornoRoma, istanteRoma } from "@/crm/tempo";

const ORE = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const oraRoma = (iso: string): string => ORE.format(new Date(iso));

export const conGiorno = (iso: string | null | undefined, giorno: string, oraVuota = "09:00"): string => {
  if (!iso) return istanteRoma(giorno, oraVuota);
  const [h, m, s] = oraRoma(iso).split(":");
  const nuovo = new Date(istanteRoma(giorno, `${h}:${m}`));
  nuovo.setUTCSeconds(Number(s), new Date(iso).getUTCMilliseconds());
  return nuovo.toISOString();
};

export { giornoRoma, istanteRoma };
