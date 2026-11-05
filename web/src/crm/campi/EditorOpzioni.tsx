import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Opzione } from "./tipi";

export interface RigaOpzione {
  uid: number;
  valore: string;
  colore?: string;
}

const MAX_VALORE = 120;
let prossimo = 1;
export const rigaVuota = (valore = ""): RigaOpzione => ({ uid: prossimo++, valore });

export const righeDa = (opzioni: Opzione[]): RigaOpzione[] =>
  opzioni.map((o) => (typeof o === "string" ? rigaVuota(o) : { ...rigaVuota(o.valore), colore: o.colore }));

export const opzioniDa = (righe: RigaOpzione[]): Opzione[] =>
  righe
    .filter((r) => r.valore.trim())
    .map((r) => (r.colore ? { valore: r.valore.trim(), colore: r.colore } : r.valore.trim()));

export const problemaOpzioni = (righe: RigaOpzione[]): string | null => {
  const valori = righe.map((r) => r.valore.trim()).filter(Boolean);
  if (!valori.length) return "Aggiungi almeno un'opzione.";
  if (valori.some((v) => v.length > MAX_VALORE)) return `Un'opzione sta in ${MAX_VALORE} caratteri.`;
  const doppia = valori.find((v, i) => valori.indexOf(v) !== i);
  return doppia ? `«${doppia}» c'è due volte.` : null;
};

export const EditorOpzioni = ({
  righe,
  onCambia,
  errore,
}: {
  righe: RigaOpzione[];
  onCambia: (righe: RigaOpzione[]) => void;
  errore?: string | null;
}) => {
  const [daFocalizzare, setDaFocalizzare] = useState<number | null>(null);

  const aggiungi = (dopo: number) => {
    const nuova = rigaVuota();
    onCambia([...righe.slice(0, dopo + 1), nuova, ...righe.slice(dopo + 1)]);
    setDaFocalizzare(nuova.uid);
  };

  const tasto = (e: KeyboardEvent, i: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (righe[i].valore.trim()) aggiungi(i);
  };

  return (
    <fieldset className="mt-4">
      <legend className="text-xs font-medium text-mute">Opzioni</legend>
      <div className="mt-1 space-y-1">
        {righe.map((r, i) => (
          <div key={r.uid} className="flex items-center gap-1">
            <Input
              aria-label={`Opzione ${i + 1}`}
              value={r.valore}
              autoFocus={r.uid === daFocalizzare}
              maxLength={MAX_VALORE + 1}
              aria-invalid={!!errore}
              onChange={(e) => onCambia(righe.map((x) => (x.uid === r.uid ? { ...x, valore: e.target.value } : x)))}
              onKeyDown={(e) => tasto(e, i)}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label={`Togli l'opzione ${r.valore.trim() || i + 1}`}
              onClick={() => onCambia(righe.filter((x) => x.uid !== r.uid))}
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" type="button" className="mt-1 -ml-1" onClick={() => aggiungi(righe.length - 1)}>
        <Plus />
        Aggiungi opzione
      </Button>
      {errore ? (
        <p role="alert" className="mt-1 text-cella text-danger">
          {errore}
        </p>
      ) : null}
    </fieldset>
  );
};
