import { useEffect, useRef, useState, type FunctionComponent } from "react";
import type { GridCell, ProvideEditorCallbackResult } from "@glideapps/glide-data-grid";
import { Button } from "@/components/ui/button";
import { PannelloDataOra } from "@/crm/DataOra";
import type { Editore } from "./editor";
import { ElencoMulti, ElencoScelta } from "./Editori";

interface Props {
  onFinishedEditing: (nuovo?: GridCell) => void;
}

export const editoreDellaGriglia = (editore: Editore, valore: unknown, salva: (v: unknown) => void): ProvideEditorCallbackResult<GridCell> => {
  if (editore.tipo === "scelta") {
    const Corpo: FunctionComponent<Props> = ({ onFinishedEditing }) => (
      <div className="w-[240px] p-1" data-editore-cella>
        <ElencoScelta
          opzioni={editore.opzioni}
          valore={valore}
          svuotabile={editore.svuotabile}
          onScegli={(v) => {
            salva(v);
            onFinishedEditing();
          }}
        />
      </div>
    );
    return { editor: Corpo as never, disablePadding: true };
  }
  if (editore.tipo === "multi") {
    const Corpo: FunctionComponent<Props> = ({ onFinishedEditing }) => {
      const [scelti, setScelti] = useState<string[]>(Array.isArray(valore) ? (valore as string[]) : []);
      return (
        <div className="grid w-[240px] gap-1 p-1" data-editore-cella>
          <ElencoMulti opzioni={editore.opzioni} scelti={scelti} onCambia={setScelti} />
          <Button
            size="sm"
            onClick={() => {
              salva(scelti);
              onFinishedEditing();
            }}
          >
            Salva
          </Button>
        </div>
      );
    };
    return { editor: Corpo as never, disablePadding: true };
  }
  if (editore.tipo === "istante") {
    const Corpo: FunctionComponent<Props> = ({ onFinishedEditing }) => {
      const esci = useRef<(() => boolean) | null>(null);
      const sparito = useRef(false);
      useEffect(() => {
        sparito.current = false;
        return () => {
          sparito.current = true;
          esci.current?.();
        };
      }, []);
      return (
        <div data-editore-cella className="rounded-md bg-background">
          <PannelloDataOra
            valore={valore as string | null}
            svuotabile={editore.svuotabile}
            esciRef={esci}
            onAnnulla={() => onFinishedEditing()}
            onFine={(v) => {
              salva(v);
              if (!sparito.current) onFinishedEditing();
            }}
          />
        </div>
      );
    };
    return { editor: Corpo as never, disablePadding: true };
  }
  if (editore.tipo === "data") {
    const iniziale = !valore ? "" : String(valore).slice(0, 10);
    const Corpo: FunctionComponent<Props> = ({ onFinishedEditing }) => {
      const [testo, setTesto] = useState(iniziale);
      const fine = () => {
        if (testo !== iniziale) salva(testo || null);
        onFinishedEditing();
      };
      return (
        <input
          autoFocus
          aria-label="Nuovo valore"
          type="date"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onBlur={fine}
          onKeyDown={(e) => {
            if (e.key === "Enter") fine();
          }}
          className="h-[30px] rounded-[6px] border border-acc px-2 text-cella text-ink outline-none"
        />
      );
    };
    return { editor: Corpo as never, disablePadding: true };
  }
  return undefined;
};
