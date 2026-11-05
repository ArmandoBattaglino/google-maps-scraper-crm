import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { stileColonna } from "@/crm/colonne/testate";
import { cn } from "@/lib/utils";
import { useContesto } from "../contesto";
import type { RigaVista } from "../dati";
import { testoValore } from "../formato";
import { calcolatoQui, editoreDi, eFase } from "./editor";
import { EditoreCella } from "./Editori";
import { Mostra } from "./Mostra";
import { useModifica } from "./useModifica";

const BASE = "h-riga overflow-hidden border-b border-line2 px-2 align-middle text-cella whitespace-nowrap text-ink";

export const Cella = ({ riga, campo, prima, inizioGruppo }: { riga: RigaVista; campo: string; prima: boolean; inizioGruppo?: boolean }) => {
  const ctx = useContesto();
  const { valore: valoreDi, salva, erroreDi, opzioniFase } = useModifica();
  const [inModifica, setInModifica] = useState(false);
  const base = editoreDi(ctx, campo);
  const senzaLegame = (campo.startsWith("azienda.") && campo !== "azienda.nome" && !riga.azienda_id) || (campo.startsWith("persona.") && campo !== "persona.nome" && !riga.persona_id) || calcolatoQui(ctx.risorsa, riga, campo);
  const editore = senzaLegame ? null : base && ctx.risorsa === "trattative" && eFase(campo) ? { ...base, opzioni: opzioniFase(riga) } : base;
  const valore = valoreDi(riga, campo);
  const errore = erroreDi(riga, campo);
  const testo = testoValore(ctx, campo, valore);

  const attiva = () => {
    if (!editore) return;
    if (editore.tipo === "booleano") void salva(riga, campo, !valore);
    else setInModifica(true);
  };
  const scrivi = (v: unknown) => {
    setInModifica(false);
    void salva(riga, campo, v);
  };

  if (inModifica && editore) {
    return (
      <td data-campo={campo} style={stileColonna(campo)} className={cn(BASE, "relative overflow-visible px-1", inizioGruppo && "border-l border-l-line")}>
        <EditoreCella riga={riga} editore={editore} valore={valore} testoAttuale={testo} onSalva={scrivi} onAnnulla={() => setInModifica(false)} />
      </td>
    );
  }
  return (
    <td
      data-campo={campo}
      style={stileColonna(campo)}
      data-modificabile={editore ? "" : undefined}
      data-errore={errore ? "" : undefined}
      title={errore}
      tabIndex={editore ? 0 : undefined}
      onClick={(e: MouseEvent) => {
        if (!(e.target as HTMLElement).closest("a")) attiva();
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          attiva();
        }
      }}
      className={cn(
        BASE,
        inizioGruppo && "border-l border-l-line",
        editore && "cursor-text outline-none hover:shadow-[inset_0_0_0_1px_var(--line-strong)] focus-visible:shadow-[inset_0_0_0_2px_var(--acc)]",
        errore && "shadow-[inset_0_0_0_1px_var(--danger)]",
      )}
    >
      <Mostra campo={campo} valore={valore} riga={riga} prima={prima} />
    </td>
  );
};
