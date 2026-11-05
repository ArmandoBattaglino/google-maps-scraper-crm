import { useGetList } from "ra-core";
import { Target, Users } from "lucide-react";
import { AvatarPersona, GruppoLegami, Legame, PallinoFase } from "@/components/crm/forme";
import { TUTTE, formaFase, percorsoTrattativa, useFasi } from "@/crm/scheda/dati";
import { euro } from "@/crm/scheda/formati";
import { AggiungiPersona } from "@/crm/persone/PersoneDellAzienda";
import { pathPersona } from "@/crm/persone/campi";
import { ProvenienzaLato } from "@/crm/origini/DaDoveScheda";
import { SezioneTag } from "@/crm/tag";
import { ApriTrattativa } from "./ApriTrattativa";

export interface PersonaLegata {
  id: string;
  nome: string;
  ruolo?: string;
  telefono?: string;
}
export interface TrattativaLegata {
  id: string;
  fase_id: string;
  prossimo_passo?: string;
  valore?: number | string | null;
  contatto_id?: string | null;
  archiviata_il?: string | null;
}

export const useLegamiAzienda = (azienda: string) => {
  const persone = useGetList<PersonaLegata>("persone", { filter: { azienda_id: azienda, "archiviata_il@is": "null" }, pagination: TUTTE, sort: { field: "nome", order: "ASC" } });
  const trattative = useGetList<TrattativaLegata>("trattative", { filter: { azienda_id: azienda }, pagination: TUTTE, sort: { field: "creato", order: "DESC" } });
  return { persone: persone.data ?? [], trattative: trattative.data ?? [] };
};

const Nessuno = ({ children }: { children: string }) => <p className="px-2 py-1 text-mute">{children}</p>;

export const AziendaLato = ({
  azienda,
  esito,
  contatto,
  referente,
  persone,
  trattative,
}: {
  azienda: string;
  esito?: string;
  contatto?: string | null;
  referente?: string;
  persone: PersonaLegata[];
  trattative: TrattativaLegata[];
}) => {
  const fasi = useFasi();
  const vive = trattative.filter((t) => !t.archiviata_il && fasi.get(t.fase_id)?.tipo === "aperta").length;
  return (
    <>
      <ProvenienzaLato azienda={azienda} />
      <GruppoLegami icona={<Target />} titolo="Trattative" conteggio={trattative.length ? `${vive} su ${trattative.length}` : 0}>
        {trattative.length ? (
          trattative.map((t) => {
            const f = fasi.get(t.fase_id);
            return (
              <Legame
                key={t.id}
                segno={<PallinoFase fase={formaFase(f)} />}
                titolo={f?.nome ?? t.fase_id}
                sotto={t.archiviata_il ? "archiviata" : t.prossimo_passo}
                destra={Number(t.valore) ? euro(t.valore) : undefined}
                to={percorsoTrattativa(t.id)}
              />
            );
          })
        ) : (
          <Nessuno>Ancora nessuna trattativa.</Nessuno>
        )}
        <ApriTrattativa azienda={azienda} esito={esito} contatto={contatto} referente={referente} aperte={vive} />
      </GruppoLegami>
      <GruppoLegami icona={<Users />} titolo="Persone" conteggio={persone.length}>
        {persone.length ? (
          persone.map((p) => (
            <Legame key={p.id} segno={<AvatarPersona nome={p.nome} />} titolo={p.nome} sotto={p.ruolo} destra={p.telefono} to={pathPersona(p.id)} />
          ))
        ) : (
          <Nessuno>Ancora nessuna persona.</Nessuno>
        )}
        <AggiungiPersona aziendaId={azienda} className="mt-0.5 text-mute" />
      </GruppoLegami>
      <SezioneTag oggetto="azienda" oggettoId={azienda} />
    </>
  );
};
