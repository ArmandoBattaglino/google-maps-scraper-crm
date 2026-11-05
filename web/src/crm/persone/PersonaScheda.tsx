import type { ReactNode } from "react";
import { LinkBase, ShowBase, useGetList, useGetOne, useShowContext, useUpdate } from "ra-core";
import { Campo as CampoModifica, TitoloScheda } from "@/crm/scheda/Campo";
import { AtSign, Briefcase, Building2, Clock, Mail, Pencil, Phone, UserRound } from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbPage } from "@/components/admin/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { AvatarPersona, Chip } from "@/components/crm/forme";
import { Timeline } from "@/crm/attivita";
import { SezioneTag } from "@/crm/tag";
import { BottoneWhatsapp } from "@/crm/whatsapp";
import { cn } from "@/lib/utils";
import { DaDoveScheda } from "@/crm/origini/DaDoveScheda";
import { Legami, type AziendaLegata, type Trattativa } from "./Legami";
import { Assente, Puntini } from "./link";
import { hrefEmail, hrefTelefono, pathAzienda, pathModificaPersona, type Persona } from "./campi";

const Campo = ({ icona, etichetta, children }: { icona: ReactNode; etichetta: string; children: ReactNode }) => (
  <div className="grid min-h-8 grid-cols-[150px_minmax(0,1fr)] items-center">
    <dt className="flex items-center gap-2 text-mute [&_svg]:size-3.5 [&_svg]:text-mute-deco">
      {icona}
      {etichetta}
    </dt>
    <dd className="min-w-0 truncate px-2 py-1">{children}</dd>
  </div>
);

const useSalvaPersona = (persona: Persona) => {
  const [aggiorna] = useUpdate();
  return (campo: string) => (v: string) =>
    aggiorna("persone", { id: persona.id, data: { [campo]: v }, previousData: persona }, { mutationMode: "pessimistic", returnPromise: true });
};

const Identita = ({ persona, azienda }: { persona: Persona; azienda?: AziendaLegata }) => {
  const salva = useSalvaPersona(persona);
  const tel = hrefTelefono(persona.telefono);
  const mail = hrefEmail(persona.email);
  const sotto = [persona.ruolo, azienda?.nome].filter(Boolean).join(", ");
  return (
    <div className="flex flex-wrap items-start gap-3.5">
      <span className="[&>span]:size-11 [&>span]:text-base">
        <AvatarPersona nome={persona.nome} />
      </span>
      <div className="min-w-0">
        <TitoloScheda nome="nome" etichetta="Nome" valore={persona.nome} onSalva={salva("nome")} />
        {sotto ? <p className="mt-[3px] text-ink2">{sotto}</p> : null}
        {persona.archiviata_il ? (
          <div className="mt-3 flex gap-2">
            <Chip>Archiviata</Chip>
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex gap-2">
        {tel ? (
          <a href={tel} className={cn(buttonVariants())}>
            <Phone />
            Chiama
          </a>
        ) : null}
        <BottoneWhatsapp persona_id={persona.id} />
        {mail ? (
          <a href={mail} className={cn(buttonVariants({ variant: "outline" }))}>
            <Mail />
            Scrivi
          </a>
        ) : null}
        <LinkBase to={pathModificaPersona(persona.id)} className={cn(buttonVariants({ variant: "outline" }))}>
          <Pencil />
          Modifica
        </LinkBase>
      </div>
    </div>
  );
};

const Contenuto = () => {
  const { record: persona, isPending } = useShowContext<Persona>();
  const [aggiorna] = useUpdate();
  const salva = (campo: string) => (v: string) =>
    aggiorna("persone", { id: persona?.id, data: { [campo]: v }, previousData: persona }, { mutationMode: "pessimistic", returnPromise: true });
  const id = persona?.id;
  const aziendaId = persona?.azienda_id;
  const { data: azienda } = useGetOne<AziendaLegata>("aziende", { id: aziendaId ?? "" }, { enabled: !!aziendaId });
  const { data: trattative } = useGetList<Trattativa>(
    "trattative",
    { filter: { persona_id: id }, sort: { field: "aggiornato", order: "DESC" }, pagination: { page: 1, perPage: 100 } },
    { enabled: !!id },
  );
  if (isPending || !persona) {
    return (
      <div className="p-8">
        <Puntini etichetta="Carico la persona" />
      </div>
    );
  }
  const lista = trattative ?? [];
  const legata = aziendaId ? azienda : undefined;
  return (
    <div data-pagina="persona" className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Breadcrumb>
        <BreadcrumbItem>
          <LinkBase to="/">Oggi</LinkBase>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <LinkBase to="/persone">Persone</LinkBase>
        </BreadcrumbItem>
        <BreadcrumbPage>{persona.nome}</BreadcrumbPage>
      </Breadcrumb>
      <div className="min-w-0 border-line px-8 pt-6 pb-12 lg:border-r">
        <Identita persona={persona} azienda={legata} />
        <dl className="mt-[22px] grid grid-cols-1 gap-x-7 gap-y-0.5 md:grid-cols-2">
          <CampoModifica nome="telefono" etichetta="Telefono" icona={<Phone />} valore={persona.telefono} href={hrefTelefono(persona.telefono) ?? undefined} onSalva={salva("telefono")} />
          <CampoModifica nome="email" etichetta="Email" icona={<AtSign />} valore={persona.email} href={hrefEmail(persona.email) ?? undefined} onSalva={salva("email")} />
          <Campo icona={<Building2 />} etichetta="Azienda">
            {legata ? (
              <LinkBase to={pathAzienda(legata.id)} className="text-acc-ink hover:underline">
                {legata.nome}
              </LinkBase>
            ) : (
              <Assente />
            )}
          </Campo>
          <CampoModifica nome="ruolo" etichetta="Posizione" icona={<Briefcase />} valore={persona.ruolo} onSalva={salva("ruolo")} />
          <Campo icona={<Clock />} etichetta="Creata il">
            {new Date(persona.creato).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}
          </Campo>
          <Campo icona={<UserRound />} etichetta="Creata da">
            {persona.creato_da ? persona.creato_da.split("@")[0] : <Assente />}
          </Campo>
        </dl>
        <DaDoveScheda azienda={aziendaId} />
        <div className="mt-5">
          <SezioneTag oggetto="persona" oggettoId={persona.id} />
        </div>
        <Timeline persona_id={persona.id} />
      </div>
      <aside className="bg-rec-side px-5 pt-5 pb-12" aria-label="Oggetti collegati">
        <Legami azienda={legata} trattative={lista} />
      </aside>
    </div>
  );
};

export const PersonaScheda = () => (
  <ShowBase>
    <Contenuto />
  </ShowBase>
);
