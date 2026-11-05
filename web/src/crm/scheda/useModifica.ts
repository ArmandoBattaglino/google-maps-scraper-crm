import { useRef, useState, type ReactNode } from "react";
import { useNotify } from "ra-core";

export interface OpzioniModifica {
  valore: string;
  onSalva: (valore: string) => Promise<unknown>;
  controlla?: (valore: string) => Promise<ReactNode | null>;
}

export const useModifica = ({ valore, onSalva, controlla }: OpzioniModifica) => {
  const notify = useNotify();
  const [bozza, setBozza] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<ReactNode>(null);
  const fermo = useRef(false);

  const chiudi = () => {
    fermo.current = true;
    setBozza(null);
    setAvviso(null);
  };
  const apri = () => {
    fermo.current = false;
    setAvviso(null);
    setBozza(valore);
  };
  const salva = async (daSalvare: string | null = bozza, { forza = false } = {}) => {
    if (fermo.current || daSalvare === null) return;
    if (daSalvare === valore) return chiudi();
    fermo.current = true;
    try {
      if (controlla && !forza && daSalvare.trim()) {
        const a = await controlla(daSalvare);
        if (a) {
          setAvviso(a);
          fermo.current = false;
          return;
        }
      }
      await onSalva(daSalvare);
      chiudi();
    } catch (e) {
      fermo.current = false;
      notify(e instanceof Error && e.message ? e.message : "Non sono riuscito a salvare", { type: "error" });
    }
  };
  const scrivi = (v: string) => {
    setBozza(v);
    setAvviso(null);
  };
  return { bozza, avviso, apri, chiudi, salva, scrivi, aperto: bozza !== null };
};
