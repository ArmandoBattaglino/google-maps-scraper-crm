const ORA = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });
const GIORNO = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const GIORNO_ANNO = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const stessoGiorno = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export const quandoBreve = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (stessoGiorno(d, new Date())) return `oggi, ${ORA.format(d)}`;
  if (stessoGiorno(d, new Date(Date.now() - 86_400_000))) return `ieri, ${ORA.format(d)}`;
  return d.getFullYear() === new Date().getFullYear() ? GIORNO.format(d) : GIORNO_ANNO.format(d);
};

export const euro = (n?: number | string | null): string =>
  n === null || n === undefined || n === "" ? "" : EURO.format(Number(n));

