import { useNotify, useRedirect } from "ra-core";
import { Create } from "@/components/admin/create";
import { AziendaForm } from "./AziendaForm";
import { soloScrivibili } from "./campi";

export const AziendaNuova = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  return (
    <Create
      title="Nuova azienda"
      transform={soloScrivibili}
      mutationOptions={{
        onSuccess: (r: { id: string; nuova?: boolean }) => {
          notify(r.nuova === false ? "Questa azienda c'era già: ecco la sua scheda" : "Azienda creata");
          redirect(`/aziende/${r.id}`);
        },
      }}
    >
      <AziendaForm />
    </Create>
  );
};
