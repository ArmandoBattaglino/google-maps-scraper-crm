import { useCreate, useGetIdentity, useGetList, useGetOne, useNotify } from "ra-core";
import type { Legami, Soggetto } from "@/crm/attivita/campi";
import { useLegami, useNomi } from "@/crm/attivita/dati";
import { numeroDi } from "./testo";

interface Contatto {
  id: string;
  nome: string;
  telefono: string;
  telefono_norm: string;
}
type Persona = Contatto & { ruolo: string; archiviata_il: string | null };
type Azienda = Contatto & { referente: string };

export interface Modello {
  id: string;
  nome: string;
  testo: string;
}

export interface Destinatario {
  pronto: boolean;
  numero: string;
  nome: string;
  azienda: string;
  legami: Legami;
  motivo: string;
}

const principaleDi = (persone: Persona[], referente: string) => {
  const uguale = (p: Persona) => p.nome.trim().toLowerCase() === referente.trim().toLowerCase();
  const attive = persone.filter((p) => !p.archiviata_il);
  return attive.find((p) => p.ruolo) ?? attive.find(uguale) ?? attive[0];
};

const motivoDi = (s: Soggetto) => {
  if (s.persona_id) return "Questa persona non ha un telefono.";
  if (s.azienda_id) return "Questa azienda non ha un telefono.";
  return "Né la persona né l'azienda di questa trattativa hanno un telefono.";
};

export const useDestinatario = (s: Soggetto): Destinatario => {
  const { legami, pronti } = useLegami(s);
  const personaId = legami.persona_id;
  const aziendaId = legami.azienda_id;
  const { data: persona } = useGetOne<Persona>("persone", { id: personaId ?? "" }, { enabled: Boolean(personaId) });
  const { data: azienda } = useGetOne<Azienda>("aziende", { id: aziendaId ?? "" }, { enabled: Boolean(aziendaId) });
  const cerca = Boolean(aziendaId) && !personaId;
  const { data: delle, isLoading } = useGetList<Persona>(
    "persone",
    { filter: { azienda_id: aziendaId }, sort: { field: "creato", order: "ASC" }, pagination: { page: 1, perPage: 50 } },
    { enabled: cerca },
  );
  const principale = cerca ? principaleDi(delle ?? [], azienda?.referente ?? "") : undefined;
  const diretto = numeroDi(persona) || numeroDi(azienda);
  return {
    pronto: pronti && !isLoading,
    numero: diretto || numeroDi(principale),
    nome: persona?.nome || principale?.nome || azienda?.referente || "",
    azienda: azienda?.nome ?? "",
    legami: !diretto && principale ? { ...legami, persona_id: principale.id } : legami,
    motivo: motivoDi(s),
  };
};

export const useSocio = () => {
  const { identity } = useGetIdentity();
  const nomeDi = useNomi();
  return nomeDi(identity ? String(identity.id) : null) ?? "";
};

export const useModelli = () =>
  useGetList<Modello>("modelli_messaggi", {
    filter: { canale: "whatsapp" },
    sort: { field: "nome", order: "ASC" },
    pagination: { page: 1, perPage: 200 },
  });

export const useSalvaModello = () => {
  const [create, { isPending }] = useCreate<Modello>();
  const notify = useNotify();
  const salva = async (nome: string, testo: string) => {
    try {
      const nuovo = (await create("modelli_messaggi", { data: { nome, testo } }, { returnPromise: true })) as Modello;
      notify(`Modello «${nome}» salvato.`, { type: "success" });
      return String(nuovo.id);
    } catch (e) {
      const perche = e instanceof Error && e.message ? e.message : "il server non risponde";
      notify(`Modello non salvato: ${perche}.`, { type: "error" });
      return null;
    }
  };
  return { salva, salvando: isPending };
};
