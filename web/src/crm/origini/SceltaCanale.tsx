import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scelta } from "@/crm/Scelta";
import { VOCI, type Voce } from "./voci";

export const NESSUNA = "nessuna";

export interface ValoreCanale {
  voce: Voce | typeof NESSUNA;
  da_chi: string;
}

export const canaleOk = (v: ValoreCanale) => v.voce !== "passaparola" || v.da_chi.trim().length > 0;

export const SceltaCanale = ({
  valore,
  onCambia,
  conNessuna,
  provato,
}: {
  valore: ValoreCanale;
  onCambia: (v: ValoreCanale) => void;
  conNessuna?: boolean;
  provato?: boolean;
}) => {
  const opzioni = [...(conNessuna ? [{ valore: NESSUNA, etichetta: "Resta l'origine che ha" }] : []), ...VOCI];
  const conChi = valore.voce === "passaparola" || valore.voce === "evento";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-1.5">
        <Label>Da dove arriva</Label>
        <Scelta etichetta="Da dove arriva" valore={valore.voce} opzioni={opzioni} className="w-full" onScegli={(v) => onCambia({ ...valore, voce: v as ValoreCanale["voce"] })} />
      </div>
      {conChi ? (
        <div className="grid gap-1.5">
          <Label htmlFor="canale-da-chi">{valore.voce === "passaparola" ? "Da chi" : "Quale evento o incontro"}</Label>
          <Input id="canale-da-chi" maxLength={200} value={valore.da_chi} onChange={(e) => onCambia({ ...valore, da_chi: e.target.value })} />
          {provato && !canaleOk(valore) ? <p className="text-xs text-danger">Scrivi da chi è arrivata.</p> : null}
        </div>
      ) : null}
    </div>
  );
};
