import { useSearchParams } from "react-router";
import { Create } from "@/components/admin/create";
import { PersonaForm } from "./PersonaForm";
import { pathAzienda, pathPersona, soloScrivibili } from "./campi";

export const PersonaNuova = () => {
  const [cerca] = useSearchParams();
  const azienda = cerca.get("azienda_id");
  return (
    <Create
      title="Nuova persona"
      record={azienda ? { azienda_id: azienda } : undefined}
      transform={soloScrivibili}
      redirect={(_risorsa, id) => (azienda ? pathAzienda(azienda) : pathPersona(String(id)))}
    >
      <PersonaForm />
    </Create>
  );
};
