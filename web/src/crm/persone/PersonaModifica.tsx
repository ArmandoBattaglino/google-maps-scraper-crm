import { Edit } from "@/components/admin/edit";
import { PersonaForm } from "./PersonaForm";
import { pathPersona, soloScrivibili } from "./campi";

export const PersonaModifica = () => (
  <Edit
    mutationMode="pessimistic"
    transform={soloScrivibili}
    actions={false}
    redirect={(_risorsa, id) => pathPersona(String(id))}
  >
    <PersonaForm />
  </Edit>
);
