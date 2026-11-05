import { useInput } from "ra-core";
import { PillolaFiltro } from "@/components/crm/forme";
import { Button } from "@/components/ui/button";

const TUTTE = "tutte";

export const FiltroNonAziende = ({ source = "etichetta" }: { source?: string; alwaysOn?: boolean }) => {
  const { field } = useInput({ source });
  return (
    <div className="mt-auto flex min-h-[30px] items-center">
      {field.value === TUTTE ? (
        <PillolaFiltro campo="Etichetta" valore="tutte" onTogli={() => field.onChange("")} />
      ) : (
        <Button type="button" variant="outline" data-mostra-non-aziende onClick={() => field.onChange(TUTTE)}>
          Mostra anche le non-aziende
        </Button>
      )}
    </div>
  );
};
