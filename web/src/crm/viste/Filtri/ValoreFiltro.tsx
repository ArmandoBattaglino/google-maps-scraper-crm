import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Scelta } from "@/crm/Scelta";
import { useContesto } from "../contesto";
import type { VoceCampo } from "../dati";
import type { Opzione } from "../etichette";
import { relativo } from "./leggibile";
import { DI_GIORNI, ELENCHI, SENZA_VALORE } from "./albero";

const IO = "__io__";
const SOCI = new Set(["segue", "scheda.segue", "creato_da", "chiamato_da", "trattativa.segue"]);
const SI_NO: Opzione[] = [
  { valore: "true", etichetta: "Sì" },
  { valore: "false", etichetta: "No" },
];
const LARGHEZZA = "h-7 w-full min-w-0";

const inputDi = (tipo: VoceCampo["tipo"]) => (tipo === "numero" ? "number" : tipo === "data" || tipo === "istante" ? "date" : "text");

const Casella = ({ tipo, valore, onCambia, etichetta = "Valore" }: { tipo: VoceCampo["tipo"]; valore: unknown; onCambia: (v: string) => void; etichetta?: string }) => (
  <Input
    aria-label={etichetta}
    type={inputDi(tipo)}
    value={typeof valore === "string" || typeof valore === "number" ? valore : ""}
    onChange={(e) => onCambia(e.target.value)}
    className={LARGHEZZA}
  />
);

const Spunte = ({ opzioni, valore, onCambia }: { opzioni: Opzione[]; valore: unknown; onCambia: (v: string[]) => void }) => {
  const scelti = Array.isArray(valore) ? (valore as string[]) : [];
  return (
    <div role="group" aria-label="Valori" className="max-h-[120px] w-full overflow-y-auto rounded-md border border-line p-1">
      {opzioni.map((o) => (
        <label key={o.valore} className="flex cursor-pointer items-center gap-2 rounded-[5px] px-1.5 py-1 hover:bg-hover">
          <input
            type="checkbox"
            className="size-3.5 accent-acc"
            checked={scelti.includes(o.valore)}
            onChange={(e) => onCambia(e.target.checked ? [...scelti, o.valore] : scelti.filter((x) => x !== o.valore))}
          />
          <span className="truncate">{o.etichetta}</span>
        </label>
      ))}
    </div>
  );
};

export const ValoreFiltro = ({ campo, op, valore, onCambia }: { campo: string; op: string; valore: unknown; onCambia: (v: unknown) => void }) => {
  const ctx = useContesto();
  const voce = ctx.voce(campo);
  if (!voce || SENZA_VALORE.has(op)) return null;
  if (DI_GIORNI.has(op)) {
    return <Input aria-label="Giorni" type="number" min={0} value={typeof valore === "number" ? valore : ""} onChange={(e) => onCambia(e.target.value === "" ? undefined : Number(e.target.value))} className={LARGHEZZA} />;
  }
  const parola = relativo(valore);
  if (parola) {
    return (
      <span className="flex h-7 items-center gap-1 rounded-md bg-hover px-2 text-ink2">
        {parola}
        <button type="button" aria-label="Cambia la data" onClick={() => onCambia(undefined)} className="ml-auto text-mute hover:text-ink">
          <X className="size-3.5" />
        </button>
      </span>
    );
  }
  if (op === "tra") {
    const [da, a] = Array.isArray(valore) ? valore : ["", ""];
    return (
      <div className="flex w-full items-center gap-1">
        <Casella tipo={voce.tipo} etichetta="Da" valore={da} onCambia={(v) => onCambia([v, a])} />
        <Casella tipo={voce.tipo} etichetta="A" valore={a} onCambia={(v) => onCambia([da, v])} />
      </div>
    );
  }
  const elenco = ctx.opzioniDi(campo);
  if (ELENCHI.has(op)) {
    if (elenco) return <Spunte opzioni={elenco} valore={valore} onCambia={onCambia} />;
    return (
      <Input
        aria-label="Valori separati da virgole"
        placeholder="uno, due, tre"
        value={Array.isArray(valore) ? valore.join(", ") : ""}
        onChange={(e) => onCambia(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        className={LARGHEZZA}
      />
    );
  }
  if (voce.tipo === "booleano") {
    return <Scelta etichetta="Valore" valore={typeof valore === "boolean" ? String(valore) : null} opzioni={SI_NO} onScegli={(v) => onCambia(v === "true")} className={LARGHEZZA} />;
  }
  if (elenco && (op === "uguale" || op === "diverso" || voce.tipo === "elenco" || voce.tipo === "multi")) {
    const conIo = SOCI.has(campo) ? [{ valore: IO, etichetta: "Io" }, ...elenco] : elenco;
    const scelto = valore && typeof valore === "object" && "io" in valore ? IO : typeof valore === "string" ? valore : null;
    return <Scelta etichetta="Valore" valore={scelto} opzioni={conIo} onScegli={(v) => onCambia(v === IO ? { io: true } : v)} className={LARGHEZZA} />;
  }
  return <Casella tipo={voce.tipo} valore={valore} onCambia={onCambia} />;
};
