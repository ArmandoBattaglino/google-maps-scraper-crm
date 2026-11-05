import type { ReactNode } from "react";
import { LinkBase } from "ra-core";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const COPPIE = [
  "bg-avatar-0 text-avatar-0-ink",
  "bg-avatar-1 text-avatar-1-ink",
  "bg-avatar-2 text-avatar-2-ink",
  "bg-avatar-3 text-avatar-3-ink",
  "bg-avatar-4 text-avatar-4-ink",
  "bg-avatar-5 text-avatar-5-ink",
];

const coppiaDi = (nome: string) => {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COPPIE[h % COPPIE.length];
};

const sigla = (nome: string, grande: boolean) => {
  const pezzi = nome.trim().split(/\s+/).filter(Boolean);
  if (!pezzi.length) return "?";
  const lettere = grande && pezzi.length > 1 ? pezzi[0][0] + pezzi[1][0] : pezzi[0][0];
  return lettere.toUpperCase();
};

export const LogoAzienda = ({ nome, grande = false }: { nome: string; grande?: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "grid shrink-0 place-items-center font-semibold",
      grande ? "size-11 rounded-[10px] text-base" : "size-5 rounded-[5px] text-[10.5px]",
      coppiaDi(nome),
    )}
  >
    {sigla(nome, grande)}
  </span>
);

export const AvatarPersona = ({ nome }: { nome: string }) => {
  const pezzi = nome.trim().split(/\s+/).filter(Boolean);
  const sigla = (pezzi.length > 1 ? pezzi[0][0] + pezzi[1][0] : (pezzi[0] ?? "?").slice(0, 2)).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-[22px] shrink-0 place-items-center rounded-full text-[10.5px] font-semibold",
        coppiaDi(nome),
      )}
    >
      {sigla}
    </span>
  );
};

export const ChipSocio = ({ nome }: { nome: string }) => {
  const visibile = nome.split("@")[0] || nome;
  return (
    <span
      data-chip-socio
      title={nome}
      className="inline-flex h-[22px] max-w-[180px] min-w-0 items-center gap-1.5 rounded-full bg-background pr-2 pl-[3px] align-middle text-xs font-medium text-ink2 ring-1 ring-line-strong ring-inset"
    >
      <span
        aria-hidden="true"
        className={cn("grid size-4 shrink-0 place-items-center rounded-full text-[9px] leading-none font-semibold", coppiaDi(nome))}
      >
        {sigla(visibile, true)}
      </span>
      <span className="min-w-0 truncate">{visibile}</span>
    </span>
  );
};

export type TonoChip = "neutro" | "blu" | "verde" | "ambra" | "rosso" | "viola" | "pieno" | "vuoto";

const TONI: Record<TonoChip, string> = {
  neutro: "bg-hover text-ink2",
  blu: "bg-acc-soft text-acc-ink",
  verde: "bg-esito-interessato-soft text-esito-interessato",
  ambra: "bg-esito-richiamare-soft text-esito-richiamare",
  rosso: "bg-danger-soft text-danger",
  viola: "bg-esito-proposta-soft text-esito-proposta",
  pieno: "bg-ink text-bg",
  vuoto: "bg-background text-mute ring-1 ring-inset ring-line",
};

export const Chip = ({ tono = "neutro", children }: { tono?: TonoChip; children: ReactNode }) => (
  <span className={cn("inline-flex h-[22px] items-center rounded-sm px-2 text-xs font-medium", TONI[tono])}>
    {children}
  </span>
);

export type Fase = "nuovo" | "contattato" | "consulenza" | "proposta" | "firmato" | "perso";

const FASI: Record<Fase, string> = {
  nuovo: "bg-fase-nuovo",
  contattato: "bg-fase-contattato",
  consulenza: "bg-fase-consulenza",
  proposta: "bg-fase-proposta",
  firmato: "bg-fase-firmato",
  perso: "bg-fase-perso",
};

export const TONO_DI_FASE: Record<Fase, TonoChip> = {
  nuovo: "neutro",
  contattato: "ambra",
  consulenza: "blu",
  proposta: "viola",
  firmato: "verde",
  perso: "rosso",
};

export const PallinoFase = ({ fase }: { fase: Fase }) => (
  <span aria-hidden="true" className={cn("block size-2 shrink-0 rounded-full", FASI[fase])} />
);

export const PillolaFiltro = ({
  campo,
  valore,
  onTogli,
}: {
  campo: string;
  valore: string;
  onTogli?: () => void;
}) => (
  <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-acc-soft pr-1.5 pl-2.5 text-acc-ink">
    {campo} <em className="not-italic opacity-60">=</em> {valore}
    <button
      type="button"
      onClick={onTogli}
      aria-label={`Togli il filtro ${campo}`}
      className="grid size-[18px] place-items-center rounded-full hover:bg-acc-soft-hover"
    >
      <X className="size-3.5" />
    </button>
  </span>
);

export const GruppoLegami = ({
  icona,
  titolo,
  conteggio,
  azione,
  children,
}: {
  icona: ReactNode;
  titolo: string;
  conteggio?: number | string;
  azione?: ReactNode;
  children: ReactNode;
}) => {
  const n = conteggio ?? (Array.isArray(children) ? children.length : children ? 1 : 0);
  return (
    <section className="mb-[22px]">
      <h3 className="mb-1.5 flex items-center gap-2 text-xs font-medium text-mute [&_svg]:size-3.5">
        {icona}
        {titolo}
        <span className="ml-auto tabular-nums" data-conteggio>
          {n}
        </span>
        {azione}
      </h3>
      {children}
    </section>
  );
};

export const Legame = ({
  segno,
  titolo,
  sotto,
  destra,
  href,
  to,
}: {
  segno?: ReactNode;
  titolo: string;
  sotto?: string;
  destra?: string;
  href?: string;
  to?: string;
}) => {
  const forma = "flex items-center gap-2.5 rounded-md px-2 py-[7px] text-ink hover:bg-hover";
  const dentro = (
    <>
      {segno}
      <span className="min-w-0">
        <span className="block truncate">{titolo}</span>
        {sotto ? <small className="block truncate text-xs text-mute">{sotto}</small> : null}
      </span>
      {destra ? <span className="ml-auto pl-2 text-xs whitespace-nowrap text-ink2 tabular-nums">{destra}</span> : null}
    </>
  );
  return to ? (
    <LinkBase to={to} className={forma}>
      {dentro}
    </LinkBase>
  ) : (
    <a href={href} className={forma}>
      {dentro}
    </a>
  );
};
