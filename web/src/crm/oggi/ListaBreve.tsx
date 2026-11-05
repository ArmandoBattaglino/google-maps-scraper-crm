import type { ReactNode } from "react";
import { Handshake, Phone, SquareCheck, type LucideIcon } from "lucide-react";
import { LinkBase } from "ra-core";
import { ChipSocio, LogoAzienda } from "@/components/crm/forme";
import { useNomi } from "@/crm/attivita/dati";
import { oraDi } from "@/crm/attivita/tempo";
import { dataCorta } from "@/crm/tempo";
import { Fermo } from "@/crm/trattative/Fermo";
import { cn } from "@/lib/utils";
import { linkA, type Di, type Oggi, type RigaDaFare, type RigaTrattativa } from "./dati";

const IN_PAGINA = 10;

const Gruppo = ({
  di,
  chiave,
  titolo,
  n,
  vuoto,
  righe,
  children,
}: {
  di: Di;
  chiave: string;
  titolo: string;
  n: number;
  vuoto: string;
  righe: number;
  children: ReactNode;
}) => (
  <section data-lista={chiave} aria-label={titolo}>
    <h2 className="flex h-10 items-center gap-2.5 border-b border-line px-6 font-semibold text-ink">
      {titolo}
      <span className="rounded-sm bg-hover px-1.5 text-xs font-normal text-mute tabular-nums">{n.toLocaleString("it-IT")}</span>
      {n > righe ? (
        <LinkBase to={linkA(di, chiave)} className="ml-auto text-cella font-normal text-ink2 hover:text-ink hover:underline">
          Vedi tutti
        </LinkBase>
      ) : null}
    </h2>
    {righe ? <ul>{children}</ul> : <p className="flex h-riga items-center border-b border-line2 px-6 text-cella text-mute">{vuoto}</p>}
  </section>
);

const Riga = ({ a, nome, dopo, fine }: { a: string; nome: string; dopo?: string | null; fine: ReactNode }) => (
  <li>
    <LinkBase
      to={a}
      className="flex h-riga items-center gap-2.5 border-b border-line2 px-6 text-cella outline-none hover:bg-riga-hover focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
    >
      <LogoAzienda nome={nome} />
      <span className="truncate font-medium text-ink">{nome}</span>
      {dopo ? <span className="min-w-0 truncate text-mute">{dopo}</span> : null}
      <span className="ml-auto shrink-0 whitespace-nowrap">{fine}</span>
    </LinkBase>
  </li>
);

const TIPO: Record<RigaDaFare["tipo"], { icona: LucideIcon; nome: string; senzaTesto: string }> = {
  trattativa: { icona: Handshake, nome: "Trattativa", senzaTesto: "Ricontattare" },
  richiamo: { icona: Phone, nome: "Azienda da richiamare", senzaTesto: "Richiamare" },
  compito: { icona: SquareCheck, nome: "Compito", senzaTesto: "Compito" },
};

const perQuando = (r: RigaDaFare) => {
  if (!r.quando) return "senza data";
  if (r.scaduto) return `scaduto ${dataCorta(r.quando)}`;
  return r.tipo === "richiamo" ? `oggi alle ${oraDi(r.quando)}` : "oggi";
};

export const VoceDaFare = ({ r, nomeDi }: { r: RigaDaFare; nomeDi: (email: string | null) => string | null }) => {
  const { icona: Icona, nome: nomeTipo, senzaTesto } = TIPO[r.tipo];
  const nome = r.azienda || r.persona || "Senza nome";
  const chi = nomeDi(r.chi);
  return (
    <li data-da-fare={r.chiave} data-tipo={r.tipo}>
      <LinkBase
        to={`/${r.scheda.risorsa}/${r.scheda.id}`}
        className="flex h-riga items-center gap-2.5 border-b border-line2 px-6 text-cella outline-none hover:bg-riga-hover focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <LogoAzienda nome={nome} />
        <span className="max-w-[36%] shrink-0 truncate font-medium text-ink">{nome}</span>
        {r.persona && r.persona !== nome ? <span className="max-w-[18%] shrink-0 truncate text-mute">{r.persona}</span> : null}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink2" title={[r.cosa, ...r.compiti].filter(Boolean).join(" · ") || undefined}>
          <Icona aria-label={nomeTipo} className="size-3.5 shrink-0 text-mute-deco" />
          <span className="truncate">{r.cosa || senzaTesto}</span>
          {r.compiti.length ? (
            <span className="shrink-0 text-mute">
              + {r.compiti.length} {r.compiti.length === 1 ? "compito" : "compiti"}
            </span>
          ) : null}
        </span>
        <span className="shrink-0">{chi ? <ChipSocio nome={chi} /> : <span className="text-mute">Di nessuno</span>}</span>
        <span className={cn("w-[124px] shrink-0 text-right whitespace-nowrap tabular-nums", r.scaduto ? "font-medium text-danger" : "text-ink2")}>
          {perQuando(r)}
        </span>
      </LinkBase>
    </li>
  );
};

const nomeDi = (t: RigaTrattativa) => t["azienda.nome"] || t["persona.nome"] || "Trattativa senza nome";

const Ferma = ({ t }: { t: RigaTrattativa }) => (
  <Riga a={`/trattative/${t.id}`} nome={nomeDi(t)} dopo={t["fase.nome"]} fine={<Fermo giorni={t.ferma_da ?? 0} />} />
);

const SenzaPasso = ({ t }: { t: RigaTrattativa }) => (
  <Riga
    a={`/trattative/${t.id}`}
    nome={nomeDi(t)}
    dopo={t["fase.nome"]}
    fine={<span className="text-ink2">{t.prossimo_passo ? "manca la data" : "manca il passo"}</span>}
  />
);

export const ListeBrevi = ({ o, di }: { o: Oggi; di: Di }) => {
  const nomeDi = useNomi();
  const inPagina = o.da_fare.righe.slice(0, IN_PAGINA);
  return (
    <div className="min-w-0">
      <Gruppo di={di} chiave="da-fare" titolo="Da fare" n={o.da_fare.n} righe={inPagina.length} vuoto="Niente da fare entro oggi.">
        {inPagina.map((r) => (
          <VoceDaFare key={r.chiave} r={r} nomeDi={nomeDi} />
        ))}
      </Gruppo>
      <Gruppo
        di={di}
        chiave="senza-passo"
        titolo="Senza prossimo passo"
        n={o.senza_passo.n}
        righe={o.senza_passo.righe.length}
        vuoto="Ogni trattativa aperta ha il suo prossimo passo."
      >
        {o.senza_passo.righe.map((t) => (
          <SenzaPasso key={t.id} t={t} />
        ))}
      </Gruppo>
      <Gruppo
        di={di}
        chiave="ferme-altre"
        titolo="Altre trattative ferme"
        n={o.ferme.altre.n}
        righe={o.ferme.altre.righe.length}
        vuoto="Nessun'altra trattativa ferma."
      >
        {o.ferme.altre.righe.map((t) => (
          <Ferma key={t.id} t={t} />
        ))}
      </Gruppo>
    </div>
  );
};
