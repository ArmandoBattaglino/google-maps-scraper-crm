import { useRecordContext } from "ra-core";
import { AvatarPersona } from "@/components/crm/forme";
import { LinkEmail, LinkTelefono } from "./link";
import type { Persona } from "./campi";

export const CellaNome = () => {
  const r = useRecordContext<Persona>();
  if (!r) return null;
  return (
    <span className="flex items-center gap-[9px] font-medium text-ink">
      <AvatarPersona nome={r.nome} />
      <span className="min-w-0 truncate">{r.nome}</span>
    </span>
  );
};

export const CellaTelefono = () => <LinkTelefono valore={useRecordContext<Persona>()?.telefono} />;
export const CellaEmail = () => <LinkEmail valore={useRecordContext<Persona>()?.email} />;
