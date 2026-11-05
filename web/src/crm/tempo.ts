const ROMA = "Europe/Rome";

const IN_GIORNO = new Intl.DateTimeFormat("en-CA", { timeZone: ROMA, year: "numeric", month: "2-digit", day: "2-digit" });
const IN_PEZZI = new Intl.DateTimeFormat("en-US", {
  timeZone: ROMA,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});
const CORTA = new Intl.DateTimeFormat("it-IT", { timeZone: ROMA, weekday: "short", day: "numeric", month: "numeric" });
const NUMERI = new Intl.DateTimeFormat("it-IT", { timeZone: ROMA, day: "numeric", month: "numeric" });
const INTERA = new Intl.DateTimeFormat("it-IT", { timeZone: ROMA, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const ORA = new Intl.DateTimeFormat("it-IT", { timeZone: ROMA, hour: "2-digit", minute: "2-digit" });

export const giornoRoma = (d: Date | string = new Date()): string => IN_GIORNO.format(new Date(d));

const offsetMinuti = (utc: Date): number => {
  const p = Object.fromEntries(IN_PEZZI.formatToParts(utc).map((x) => [x.type, x.value]));
  const comeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return (comeUtc - Math.floor(utc.getTime() / 60_000) * 60_000) / 60_000;
};

export const istanteRoma = (giorno: string, ora = "09:00"): string => {
  const [a, m, g] = giorno.split("-").map(Number);
  const [h, mi] = ora.split(":").map(Number);
  const t = Date.UTC(a, m - 1, g, h, mi);
  const scarto = (u: number) => offsetMinuti(new Date(u)) * 60_000;
  return new Date(t - scarto(t - scarto(t))).toISOString();
};

export const giorniDa = (iso: string, oggi: string = giornoRoma()): number =>
  Math.max(0, (Date.parse(`${oggi}T00:00:00Z`) - Date.parse(`${giornoRoma(iso)}T00:00:00Z`)) / 86_400_000);

export const dataCorta = (iso: string): string => CORTA.format(new Date(iso)).replace(",", "");
export const dataNumeri = (iso: string): string => NUMERI.format(new Date(iso));
export const dataEOra = (iso: string): string => INTERA.format(new Date(iso)).replace(",", "");
export const dataCortaOra = (iso: string): string => `${dataCorta(iso)} ${ORA.format(new Date(iso))}`;
