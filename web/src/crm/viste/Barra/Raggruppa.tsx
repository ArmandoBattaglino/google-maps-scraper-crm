import { Layers } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Scelta } from "@/crm/Scelta";
import { useContesto } from "../contesto";
import { gruppiPerScelta } from "../gruppiCampi";
import { buonoPerColonne, campoDelleColonne } from "../Kanban/colonne";
import type { Modo } from "../stato";
import { FANTASMA, NESSUNO } from "./forme";

export const Raggruppa = ({ gruppi, modo, onCambia }: { gruppi: string[]; modo: Modo; onCambia: (g: string[]) => void }) => {
  const ctx = useContesto();
  const kanban = modo === "kanban";
  const voci = ctx.campi.filter((c) => c.raggruppabile && (!kanban || buonoPerColonne(ctx, c.campo)));
  const opzioni = [{ valore: NESSUNO, etichetta: "Nessuno" }];
  const elenco = gruppiPerScelta(voci.map((c) => c.campo), ctx.nome, ctx.risorsa);
  const [primo, secondo] = kanban ? [campoDelleColonne(ctx, gruppi), undefined] : gruppi;
  const scegli = (livello: 0 | 1, v: string) => {
    const nuovi = [livello === 0 ? v : primo, livello === 1 ? v : secondo].filter((x): x is string => !!x && x !== NESSUNO);
    onCambia([...new Set(nuovi)]);
  };
  return (
    <Popover>
      <PopoverTrigger className={FANTASMA} data-raggruppa>
        <Layers />
        {primo ? (
          <span>
            Raggruppa: <b>{ctx.nome(primo)}</b>
            {secondo ? <> e <b>{ctx.nome(secondo)}</b></> : null}
          </span>
        ) : (
          "Raggruppa"
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[260px] gap-2.5 p-3 shadow-pop">
        <div className="grid gap-1">
          <Label className="text-xs text-mute">{kanban ? "Le colonne" : "Prima per"}</Label>
          <Scelta etichetta="Raggruppa prima per" valore={primo ?? NESSUNO} opzioni={opzioni} gruppi={elenco} onScegli={(v) => scegli(0, v)} className="h-7 w-full" />
        </div>
        {!kanban && primo ? (
          <div className="grid gap-1">
            <Label className="text-xs text-mute">Poi per</Label>
            <Scelta etichetta="Raggruppa poi per" valore={secondo ?? NESSUNO} opzioni={opzioni} gruppi={elenco} onScegli={(v) => scegli(1, v)} className="h-7 w-full" />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
