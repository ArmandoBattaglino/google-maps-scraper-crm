import type { ReactNode } from "react";
import { LinkBase } from "ra-core";
import { BottoneChiama } from "@/crm/chiama/BottoneChiama";
import { dataNumeri } from "@/crm/tempo";
import { cn } from "@/lib/utils";
import { linkA, type Di, type Oggi } from "./dati";

const it = (n: number) => n.toLocaleString("it-IT");
const FUOCO = "rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const Grande = ({
  di,
  chiave,
  nome,
  n,
  allarme = false,
}: {
  di: Di;
  chiave: string;
  nome: string;
  n: number;
  allarme?: boolean;
}) => (
  <LinkBase to={linkA(di, chiave)} data-numero={chiave} data-n={n} className={cn("group inline-block", FUOCO)}>
    <span className="block text-ink2">{nome}</span>
    <span
      className={cn(
        "mt-1 block text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] tabular-nums group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4",
        allarme ? "text-warn" : "text-ink",
      )}
    >
      {it(n)}
    </span>
  </LinkBase>
);

const Piccola = ({ di, chiave, n, children, tono }: { di: Di; chiave: string; n: number; children: ReactNode; tono?: string }) => (
  <LinkBase to={linkA(di, chiave)} data-numero={chiave} data-n={n} className={cn("hover:underline", FUOCO, tono ?? "text-ink2")}>
    <span className="tabular-nums">{it(n)}</span> {children}
  </LinkBase>
);

const Cella = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("min-w-0 px-6 py-4", className)}>{children}</div>
);

const Settimana = ({ di, s }: { di: Di; s: Oggi["settimana"] }) => {
  const voci = [
    { chiave: "consulenze", nome: "Appuntamenti", n: s.consulenze_fissate.n },
    { chiave: "proposte", nome: "Proposte", n: s.proposte_inviate.n },
    { chiave: "firme", nome: "Firme", n: s.firme.n },
  ];
  return (
    <Cella>
      <span className="text-ink2">
        Settimana <span className="text-mute tabular-nums">dal {dataNumeri(`${s.da}T12:00:00Z`)} al {dataNumeri(`${s.a}T12:00:00Z`)}</span>
      </span>
      <div className="mt-1 flex flex-wrap gap-x-7 gap-y-2">
        {voci.map((v) => (
          <LinkBase key={v.chiave} to={linkA(di, v.chiave)} data-numero={v.chiave} data-n={v.n} className={cn("group", FUOCO)}>
            <span className="block text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink tabular-nums group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
              {it(v.n)}
            </span>
            <span className="mt-1 block text-ink2">{v.nome}</span>
          </LinkBase>
        ))}
      </div>
    </Cella>
  );
};

export const Numeri = ({ o, di }: { o: Oggi; di: Di }) => (
  <section aria-label="I numeri di oggi" className="grid border-y border-line sm:grid-cols-2 sm:divide-x sm:divide-line xl:grid-cols-[1.25fr_1fr_1fr_1.6fr]">
    <Cella className="flex items-start justify-between gap-4">
      <div>
        <Grande di={di} chiave="da-chiamare" nome="Da chiamare" n={o.da_chiamare.n} />
        <p className="mt-1 text-cella text-mute">in coda adesso</p>
      </div>
      <BottoneChiama vuota={o.da_chiamare.n === 0} className="mt-[23px]" />
    </Cella>
    <Cella>
      <Grande di={di} chiave="da-fare" nome="Da fare entro oggi" n={o.da_fare.n} />
      <p className="mt-1 text-cella">
        <span data-da-fare-scaduti={o.da_fare.scaduti} className={cn("tabular-nums", o.da_fare.scaduti ? "font-medium text-danger" : "text-ink2")}>
          {it(o.da_fare.scaduti)} {o.da_fare.scaduti === 1 ? "scaduto" : "scaduti"}
        </span>
        <span className="text-mute">, {it(o.da_fare.oggi)} per oggi</span>
      </p>
      {o.da_fare.fonti?.compiti ? (
        <p className="text-cella">
          {}
          <LinkBase
            to={di === "team" ? "/compiti?di=team" : "/compiti"}
            data-oggi-compiti={o.da_fare.fonti.compiti.n}
            className={cn("text-mute hover:underline", FUOCO)}
          >
            di cui <span className="tabular-nums">{it(o.da_fare.fonti.compiti.n)}</span> {o.da_fare.fonti.compiti.n === 1 ? "compito" : "compiti"}
          </LinkBase>
        </p>
      ) : null}
    </Cella>
    <Cella>
      <Grande di={di} chiave="ferme" nome="Trattative ferme" n={o.ferme.n} allarme={o.ferme.n > 0} />
      <p className="mt-1 text-cella">
        <Piccola di={di} chiave="senza-passo" n={o.senza_passo.n}>
          senza prossimo passo
        </Piccola>
      </p>
    </Cella>
    <Settimana di={di} s={o.settimana} />
  </section>
);
