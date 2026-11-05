import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { chiaveLibera, type Definizione, type ErroreCampo } from "./tipi";

const quante = (n: number) => `${n.toLocaleString("it-IT")} ${n === 1 ? "riga" : "righe"}`;

const Riquadro = ({ children }: { children: ReactNode }) => (
  <div role="alert" className="mt-3 rounded-md bg-warn-soft px-2.5 py-2 text-cella text-warn">
    {children}
  </div>
);

export const AvvisoChiave = ({
  chiave,
  messaggio,
  tutte,
  onRipristina,
  onCreaCon,
}: {
  chiave: string;
  messaggio: string;
  tutte: Definizione[];
  onRipristina: (d: Definizione) => void;
  onCreaCon: (chiave: string) => void;
}) => {
  const esistente = tutte.find((d) => d.chiave === chiave);
  if (!esistente) return <Riquadro>{messaggio}</Riquadro>;
  if (!esistente.archiviato_il) {
    return <Riquadro>C'è già il campo «{esistente.etichetta}» con questa chiave: scegli un altro nome.</Riquadro>;
  }
  const libera = chiaveLibera(chiave, tutte.map((d) => d.chiave));
  return (
    <Riquadro>
      <p>«{esistente.etichetta}» è archiviato con questa chiave e i suoi valori sono ancora nelle righe.</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => onRipristina(esistente)}>
          Ripristina «{esistente.etichetta}»
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onCreaCon(libera)}>
          Crea con chiave {libera}
        </Button>
      </div>
    </Riquadro>
  );
};

export const AvvisoUsate = ({ usate, onRimetti }: { usate: NonNullable<ErroreCampo["usate"]>; onRimetti: () => void }) => (
  <Riquadro>
    <ul data-usate>
      {usate.map((u) => (
        <li key={u.valore}>
          «{u.valore}» è usata da {quante(u.righe)}.
        </li>
      ))}
    </ul>
    <p className="mt-1">Per toglierla, prima cambia il valore in quelle righe.</p>
    <Button type="button" variant="outline" size="sm" className="mt-1.5" onClick={onRimetti}>
      {usate.length === 1 ? "Rimetti l'opzione" : "Rimetti le opzioni"}
    </Button>
  </Riquadro>
);
