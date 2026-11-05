import { LinkBase, useGetList, useRecordContext } from "ra-core";
import { Plus, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AvatarPersona, GruppoLegami } from "@/components/crm/forme";
import { cn } from "@/lib/utils";
import { Puntini } from "./link";
import { NON_ARCHIVIATE, pathNuovaPersona, pathPersona, type Persona } from "./campi";

export const AggiungiPersona = ({ aziendaId, className }: { aziendaId: string; className?: string }) => (
  <LinkBase to={pathNuovaPersona(aziendaId)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), className)}>
    <Plus />
    Aggiungi persona
  </LinkBase>
);

export const PersoneDellAzienda = ({ aziendaId }: { aziendaId?: string }) => {
  const azienda = useRecordContext<{ id: string }>();
  const id = aziendaId ?? azienda?.id;
  const { data, isPending, error } = useGetList<Persona>(
    "persone",
    {
      filter: { azienda_id: id, ...NON_ARCHIVIATE },
      sort: { field: "nome", order: "ASC" },
      pagination: { page: 1, perPage: 200 },
    },
    { enabled: !!id },
  );
  if (!id) return null;
  return (
    <div data-legami="persone">
      <GruppoLegami icona={<Users />} titolo="Persone">
        {(data ?? []).map((p) => (
          <LinkBase
            key={p.id}
            to={pathPersona(p.id)}
            className="flex items-center gap-2.5 rounded-md px-2 py-[7px] text-ink hover:bg-hover"
          >
            <AvatarPersona nome={p.nome} />
            <span className="min-w-0">
              <span className="block truncate">{p.nome}</span>
              {p.ruolo ? <small className="block truncate text-xs text-mute">{p.ruolo}</small> : null}
            </span>
            {p.telefono ? (
              <span className="ml-auto text-xs whitespace-nowrap text-ink2 tabular-nums">{p.telefono}</span>
            ) : null}
          </LinkBase>
        ))}
      </GruppoLegami>
      {isPending ? <Puntini etichetta="Carico le persone" /> : null}
      {error ? <p className="mb-2 text-danger">Non riesco a leggere le persone di questa azienda.</p> : null}
      <AggiungiPersona aziendaId={id} className="-mt-3 mb-4" />
    </div>
  );
};
