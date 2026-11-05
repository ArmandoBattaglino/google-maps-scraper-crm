import { useState, type MouseEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { menuAperto, TrePuntini } from "@/crm/azioni/MenuRiga";
import { ICONA_ENTITA, NOME_ENTITA } from "@/crm/entita";
import { useSoci } from "@/crm/soci";
import { cn } from "@/lib/utils";
import { RISORSE, TUTTE, type Risorsa, type Vista } from "../stato";
import { useAzioniVista } from "./AzioniVista";

const VOCE = "flex w-full items-center gap-2 rounded-[6px] py-[5px] pr-8 pl-7 text-left text-ink [&_svg]:size-3.5 [&_svg]:shrink-0";

const Riga = ({ corrente, menu, aperto, children }: { corrente: boolean; menu: (e: MouseEvent) => void; aperto: boolean; children: ReactNode }) => (
  <div data-riga-vista onContextMenu={menu} className={cn("group/riga relative rounded-[6px] hover:bg-hover", aperto && "bg-hover")}>
    {children}
    {corrente ? (
      <Check
        data-vista-corrente
        className={cn("pointer-events-none absolute top-1/2 right-[9px] size-3.5 -translate-y-1/2 text-acc group-focus-within/riga:opacity-0 group-hover/riga:opacity-0", aperto && "opacity-0")}
      />
    ) : null}
    <TrePuntini
      onApri={menu}
      className={cn("absolute top-1/2 right-1 -translate-y-1/2 bg-transparent hover:bg-line group-focus-within/riga:opacity-100 group-hover/riga:opacity-100", aperto && "opacity-100")}
    />
  </div>
);

export const SceltaVista = ({
  titolo,
  risorsa,
  vista,
  viste,
  onApri,
}: {
  titolo: string;
  risorsa: Risorsa;
  vista?: Vista;
  viste: Vista[];
  onApri: (q: { vista: string } | { risorsa: Risorsa }) => void;
}) => {
  const [aperto, setAperto] = useState(false);
  const [cerca, setCerca] = useState("");
  const { nomeDi } = useSoci();
  const chi = (v: Vista) => (v.di === "team" ? "team" : nomeDi(v.di));
  const parola = cerca.trim().toLowerCase();
  const apri = (q: { vista: string } | { risorsa: Risorsa }) => {
    setAperto(false);
    onApri(q);
  };
  const azioni = useAzioniVista({ vistaAperta: vista, viste, onApri, chiudiElenco: () => setAperto(false) });
  return (
    <>
      <Popover
        open={aperto}
        onOpenChange={(a) => {
          if (!a && menuAperto()) return;
          setAperto(a);
        }}
      >
        <PopoverTrigger data-scelta-vista className="inline-flex items-center gap-1 rounded-[6px] px-1 -ml-1 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring/50">
          {titolo}
          <ChevronDown className="size-4 text-mute-deco" />
        </PopoverTrigger>
        <PopoverContent align="start" data-elenco-viste className="max-h-[70vh] w-[320px] gap-1.5 overflow-y-auto p-2 text-sm font-normal tracking-normal shadow-pop">
          <Input aria-label="Cerca una vista" placeholder="Cerca una vista" value={cerca} onChange={(e) => setCerca(e.target.value)} className="h-7" />
          {RISORSE.map((r, i) => {
            const Icona = ICONA_ENTITA[r];
            const sue = viste.filter((v) => v.tabella === r && v.nome.toLowerCase().includes(parola));
            return (
              <section key={r} data-gruppo-entita={r} aria-label={NOME_ENTITA[r]} className={cn("pt-2", i > 0 && "mt-1 border-t border-line")}>
                <h3 className="flex items-center gap-1.5 px-2 pb-1 text-sm font-semibold text-ink [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-ink2">
                  <Icona />
                  {NOME_ENTITA[r]}
                </h3>
                <Riga corrente={!vista && risorsa === r} menu={(e) => azioni.apri(e, { partenza: r })} aperto={azioni.aperta({ partenza: r })}>
                  <button type="button" data-tabella={r} className={VOCE} onClick={() => apri({ risorsa: r })}>
                    <span className="min-w-0 flex-1 truncate">{TUTTE[r]}</span>
                  </button>
                </Riga>
                {sue.map((v) => (
                  <Riga key={v.id} corrente={vista?.id === v.id} menu={(e) => azioni.apri(e, { vista: v })} aperto={azioni.aperta({ vista: v })}>
                    <button type="button" data-vista={v.id} className={VOCE} onClick={() => apri({ vista: v.id })}>
                      <span className="min-w-0 flex-1 truncate">{v.nome}</span>
                      <span className={cn("max-w-[110px] truncate text-xs text-mute")}>{chi(v)}</span>
                    </button>
                  </Riga>
                ))}
              </section>
            );
          })}
        </PopoverContent>
      </Popover>
      {azioni.nodo}
    </>
  );
};
