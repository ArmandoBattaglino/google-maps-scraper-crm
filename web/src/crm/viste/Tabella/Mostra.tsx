import { LinkBase } from "ra-core";
import { AvatarPersona, Chip, ChipSocio, LogoAzienda, type TonoChip } from "@/components/crm/forme";
import { DaDove, StatoDaTesto } from "@/crm/colonne/celle";
import type { DatiDaDove } from "@/crm/colonne/daDove";
import { SuPiuRecente } from "@/crm/colonne/segue";
import { campoDiSocio, eSocio, useContesto } from "../contesto";
import type { RigaVista } from "../dati";
import { TESTO_INTERO, testoValore } from "../formato";
import type { Risorsa } from "../stato";

const TONO_ESITO: Record<string, TonoChip> = {
  "da-chiamare": "vuoto",
  "non-risponde": "neutro",
  richiamare: "ambra",
  "non-interessato": "rosso",
  interessato: "verde",
};
const CON_LOGO = new Set(["azienda.nome"]);
const CON_AVATAR = new Set(["persona.nome"]);

export const schedaDi = (risorsa: Risorsa, riga: RigaVista): string | null => {
  if (risorsa === "attivita") return riga.azienda_id ? `/aziende/${String(riga.azienda_id)}` : null;
  return `/${risorsa}/${riga.id}`;
};

export const Mostra = ({ campo, valore, riga, prima }: { campo: string; valore: unknown; riga: RigaVista; prima: boolean }) => {
  const ctx = useContesto();
  const testo = testoValore(ctx, campo, valore);
  const voce = ctx.voce(campo);
  if (!testo && !prima && campo !== "da_dove") return <span className="text-assente">—</span>;
  const scelta = ctx.opzioniDi(campo);
  const scheda = prima ? schedaDi(ctx.risorsa, riga) : null;
  const nome = scheda ? (
    <LinkBase to={scheda} className="min-w-0 truncate hover:underline hover:underline-offset-3" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      {testo || "Senza nome"}
    </LinkBase>
  ) : (
    <span className="min-w-0 truncate">{testo}</span>
  );
  if (prima || CON_LOGO.has(campo) || CON_AVATAR.has(campo) || (campo === "nome" && ctx.risorsa === "aziende")) {
    return (
      <span className={prima ? "flex min-w-0 items-center gap-[9px] font-medium" : "flex min-w-0 items-center gap-[9px]"}>
        {CON_AVATAR.has(campo) || (campo === "nome" && ctx.risorsa === "persone") ? (
          <AvatarPersona nome={testo || "?"} />
        ) : CON_LOGO.has(campo) || campo === "nome" ? (
          <LogoAzienda nome={testo || "?"} />
        ) : null}
        {nome}
      </span>
    );
  }
  if (eSocio(campo, valore)) {
    return (
      <span className="flex min-w-0">
        <ChipSocio nome={testo} />
        {campo === "scheda.segue" ? <SuPiuRecente altre={(riga.segue_su as { altre_aperte?: number } | null | undefined)?.altre_aperte} /> : null}
      </span>
    );
  }
  if (campo === "stato") return <StatoDaTesto testo={testo} segni={riga.stato_segni} />;
  if (campo === "da_dove") return <DaDove d={riga.da_dove_dati as DatiDaDove | null} />;
  if (campo === "fase.nome" || campo === "fase_id") return <Chip tono={ctx.tonoFase(String(valore))}>{testo}</Chip>;
  if (campo === "esito" || campo === "azienda.esito") return <Chip tono={TONO_ESITO[String(valore)] ?? "neutro"}>{testo}</Chip>;
  if (voce?.tipo === "multi" || voce?.tipo === "elenco") {
    return (
      <span className="flex gap-1 overflow-hidden">
        {(valore as string[]).map((x) => (
          <Chip key={x}>{ctx.etichettaDi(campo, x)}</Chip>
        ))}
      </span>
    );
  }
  if (scelta?.length && !campoDiSocio(campo)) return <Chip>{testo}</Chip>;
  return (
    <span className="block truncate" title={TESTO_INTERO.has(campo) ? testo : undefined}>
      {testo}
    </span>
  );
};
