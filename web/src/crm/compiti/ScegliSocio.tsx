import { useState } from "react";
import { Check } from "lucide-react";
import { ChipSocio } from "@/components/crm/forme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Socio } from "@/crm/soci";

export const ScegliSocio = ({
  valore,
  nome,
  soci,
  etichetta,
  onScegli,
}: {
  valore: string | null;
  nome: string;
  soci: Socio[];
  etichetta: string;
  onScegli: (email: string) => void;
}) => {
  const [aperto, setAperto] = useState(false);
  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger
        type="button"
        data-scegli-socio
        aria-label={`${etichetta}: ${nome || "nessuno"}`}
        className="inline-flex max-w-full rounded-full outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {nome ? <ChipSocio nome={nome} /> : <span className="text-xs text-mute">Di nessuno</span>}
      </PopoverTrigger>
      <PopoverContent align="start" data-elenco-soci className="w-[240px] gap-0.5 p-1 shadow-pop">
        {soci.map((s) => {
          const email = s.email.toLowerCase();
          return (
            <button
              key={email}
              type="button"
              data-socio={email}
              aria-pressed={email === valore}
              onClick={() => {
                setAperto(false);
                if (email !== valore) onScegli(email);
              }}
              className="flex w-full items-center gap-2 rounded-[6px] px-1.5 py-1 text-left outline-none hover:bg-hover focus-visible:bg-hover"
            >
              <ChipSocio nome={s.nome || s.email} />
              {email === valore ? <Check aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-acc" /> : null}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
