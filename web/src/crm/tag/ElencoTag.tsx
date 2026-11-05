import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Chip } from "@/components/crm/forme";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { COLORI, tonoDi, type ColoreTag } from "./colori";
import type { Tag } from "./dati";

const senzaAccenti = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const ElencoTag = ({
  tutti,
  scelti,
  onScegli,
  onCrea,
  vuoto,
}: {
  tutti: Tag[];
  scelti?: Set<string>;
  onScegli: (tag: Tag) => void;
  onCrea?: (nome: string, colore: ColoreTag) => Promise<boolean>;
  vuoto: string;
}) => {
  const [testo, setTesto] = useState("");
  const [colore, setColore] = useState(COLORI[0]);
  const nome = testo.trim();
  const cercato = senzaAccenti(nome);
  const visibili = tutti.filter((t) => senzaAccenti(t.nome).includes(cercato));
  const creabile = !!onCrea && !!nome && !tutti.some((t) => t.nome.toLowerCase() === nome.toLowerCase());

  const crea = async () => {
    if (onCrea && (await onCrea(nome, colore))) {
      setTesto("");
      setColore(COLORI[0]);
    }
  };

  return (
    <Command shouldFilter={false} label="Tag" className="rounded-[9px]!">
      <CommandInput
        value={testo}
        onValueChange={setTesto}
        maxLength={60}
        placeholder={onCrea ? "Cerca o crea un tag" : "Cerca un tag"}
      />
      <CommandList className="max-h-56">
        <CommandEmpty className="px-2 py-4 text-mute">{nome ? "Nessun tag con questo nome." : vuoto}</CommandEmpty>
        {visibili.length ? (
          <CommandGroup>
            {visibili.map((t) => (
              <CommandItem key={t.id} value={t.id} onSelect={() => onScegli(t)} className="min-h-[30px] py-1">
                <span className="min-w-0 truncate">
                  <Chip tono={tonoDi(t.colore)}>{t.nome}</Chip>
                </span>
                {scelti?.has(t.id) ? <Check aria-label="già messo" className="ml-auto text-acc" /> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {creabile ? (
          <CommandGroup className={cn(visibili.length > 0 && "border-t border-line2")}>
            <CommandItem value="crea-il-tag" onSelect={() => void crea()} className="min-h-[30px] py-1 text-ink">
              <Plus className="text-mute-deco" />
              <span className="min-w-0 truncate">Crea il tag «{nome}»</span>
            </CommandItem>
          </CommandGroup>
        ) : null}
      </CommandList>
      {creabile ? (
        <div role="group" aria-label="Colore del tag" className="flex items-center gap-1 px-3 pt-1 pb-2">
          {COLORI.map((c) => (
            <button
              key={c.nome}
              type="button"
              aria-label={`Colore ${c.nome}`}
              aria-pressed={c === colore}
              onClick={() => setColore(c)}
              className={cn(
                "grid size-[22px] place-items-center rounded-full ring-inset hover:bg-hover",
                c === colore && "ring-1 ring-line-strong",
              )}
            >
              <span className={cn("block size-2.5 rounded-full", c.campione)} />
            </button>
          ))}
        </div>
      ) : null}
    </Command>
  );
};
