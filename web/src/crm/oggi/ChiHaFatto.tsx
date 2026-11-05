import { LinkBase } from "ra-core";
import { AvatarPersona } from "@/components/crm/forme";
import { cn } from "@/lib/utils";
import { linkA, type Conti, type Di, type Oggi } from "./dati";

const COLONNE = "grid grid-cols-[minmax(0,1fr)_88px_80px_64px] items-center gap-x-2";

const Cifra = ({ di, chiave, socio, tipo, n }: { di: Di; chiave: string; socio?: string; tipo?: string; n: number }) => (
  <LinkBase
    to={linkA(di, chiave, { socio, tipo })}
    data-numero={`${chiave}${tipo ? `-${tipo}` : ""}${socio ? `-${socio}` : ""}`}
    data-n={n}
    className={cn(
      "rounded-sm text-right tabular-nums outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
      n ? "text-ink" : "text-mute",
    )}
  >
    {n.toLocaleString("it-IT")}
  </LinkBase>
);

const Cifre = ({ di, socio, oggi, settimana }: { di: Di; socio?: string; oggi: Conti; settimana: Conti }) => (
  <>
    <Cifra di={di} chiave="fatte-oggi" socio={socio} tipo="chiamata" n={oggi.chiamata ?? 0} />
    <Cifra di={di} chiave="fatte-oggi" socio={socio} n={oggi.totale} />
    <Cifra di={di} chiave="fatte-settimana" socio={socio} n={settimana.totale} />
  </>
);

export const ChiHaFatto = ({ o, di }: { o: Oggi; di: Di }) => {
  const c = o.chi_ha_fatto;
  return (
    <section aria-label="Chi ha fatto cosa" className="min-w-0 border-line lg:border-l">
      <h2 className="flex h-10 items-center border-b border-line px-6 font-semibold text-ink">
        {di === "team" ? "Chi ha fatto cosa" : "Cosa ho fatto"}
      </h2>
      <div className={cn(COLONNE, "h-8 border-b border-line2 px-6 text-xs whitespace-nowrap text-mute")}>
        <span>Utente</span>
        <span className="text-right">Chiamate oggi</span>
        <span className="text-right">Attività oggi</span>
        <span className="text-right">Settimana</span>
      </div>
      <ul>
        {c.soci.map((s) => (
          <li key={s.email} data-socio={s.email} className={cn(COLONNE, "h-riga border-b border-line2 px-6 text-cella")}>
            <span className="flex min-w-0 items-center gap-2 text-ink">
              <AvatarPersona nome={s.nome || s.email} />
              <span className="truncate">{s.nome || s.email.split("@")[0]}</span>
            </span>
            <Cifre di={di} socio={s.email} oggi={s.oggi} settimana={s.settimana} />
          </li>
        ))}
      </ul>
      {di === "team" ? (
        <div className={cn(COLONNE, "h-riga px-6 text-cella font-medium")} data-totali>
          <span className="text-ink2">Totale</span>
          <Cifre di={di} oggi={c.totali.oggi} settimana={c.totali.settimana} />
        </div>
      ) : null}
    </section>
  );
};
