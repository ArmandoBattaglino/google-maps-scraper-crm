const FUSO = "Europe/Rome";

const chiaveGiorno = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const ora = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const settimana = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, weekday: "short" });
const lunga = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });
const conAnno = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const pezzi = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSO,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

export const giornoDi = (quando: string | number | Date) => chiaveGiorno.format(new Date(quando));
export const oraDi = (quando: string) => ora.format(new Date(quando));
export const dataCorta = (quando: string) => {
  const giorno = giornoDi(quando);
  return `${settimana.format(new Date(quando))} ${+giorno.slice(8)}/${+giorno.slice(5, 7)}`;
};

export const spostaGiorno = (giorno: string, n: number) =>
  new Date(Date.parse(`${giorno}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const oggi = () => giornoDi(Date.now());
export const domani = () => spostaGiorno(oggi(), 1);

export const etichettaGiorno = (giorno: string) => {
  const adesso = oggi();
  if (giorno === adesso) return "Oggi";
  if (giorno === spostaGiorno(adesso, -1)) return "Ieri";
  const mezzogiorno = new Date(`${giorno}T12:00:00Z`);
  const testo = (giorno.slice(0, 4) === adesso.slice(0, 4) ? lunga : conAnno).format(mezzogiorno);
  return testo.charAt(0).toUpperCase() + testo.slice(1);
};

const scarto = (t: number) => {
  const p = Object.fromEntries(pezzi.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
};

export const romaAIso = (orologio: string) => {
  const t = Date.parse(`${orologio}Z`);
  return new Date(t - scarto(t - scarto(t))).toISOString();
};
