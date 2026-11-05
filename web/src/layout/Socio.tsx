import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useIo } from "@/hooks/useIo";
import { useMarca } from "@/hooks/useMarca";
import { Attesa, Avviso } from "./Avviso";

export const Socio = ({ children }: { children: ReactNode }) => {
  const { data: io, isPending, refetch, isFetching } = useIo();
  const { nome } = useMarca();
  useEffect(() => {
    document.title = nome;
  }, [nome]);

  if (isPending) return <Attesa />;

  if (!io) {
    return (
      <Avviso
        titolo="Il CRM non risponde"
        azioni={
          <Button onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Riprovo..." : "Riprova"}
          </Button>
        }
      >
        <p>Il servizio del CRM non ha risposto: controlla che i container siano accesi e riprova fra qualche secondo.</p>
      </Avviso>
    );
  }

  return <>{children}</>;
};
