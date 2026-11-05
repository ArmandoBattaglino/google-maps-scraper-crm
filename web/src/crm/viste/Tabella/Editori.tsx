import { useRef, useState } from "react";
import { DataOra } from "@/crm/DataOra";
import { useGetList } from "ra-core";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Opzione } from "../etichette";
import type { Editore } from "./editor";

export const CASELLA = "h-[30px] w-full rounded-[6px] border border-acc px-2 text-cella text-ink shadow-[0_0_0_3px_var(--acc-soft)] outline-none";
const VOCE = "flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-ink2 hover:bg-hover hover:text-ink [&_svg]:size-3.5";

interface PropsEditore {
  editore: Editore;
  valore: unknown;
  onSalva: (v: unknown) => void;
  onAnnulla: () => void;
}

const inizialeInput = (editore: Editore, v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (editore.tipo === "data") return String(v).slice(0, 10);
  return String(v);
};

const Casella = ({ editore, valore, onSalva, onAnnulla }: PropsEditore) => {
  const iniziale = inizialeInput(editore, valore);
  const [testo, setTesto] = useState(iniziale);
  const chiuso = useRef(false);
  const chiudi = (salva: boolean) => {
    if (chiuso.current) return;
    chiuso.current = true;
    if (!salva || testo === iniziale) return onAnnulla();
    if (editore.tipo === "numero") return onSalva(testo === "" ? null : Number(testo));
    onSalva(testo);
  };
  if (editore.lungo) {
    return (
      <div className="relative h-[30px]">
        <textarea
          autoFocus
          aria-label="Nuovo valore"
          rows={4}
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onBlur={() => chiudi(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              chiudi(true);
            }
            if (e.key === "Escape") chiudi(false);
          }}
          onFocus={(e) => e.target.select()}
          className={cn(CASELLA, "absolute top-0 left-0 z-10 h-auto w-[320px] resize-none bg-background py-1.5 leading-[18px] whitespace-pre-wrap")}
        />
        <p className="absolute top-[100px] left-0 z-10 rounded-[6px] border border-line bg-background px-2 py-1 text-xs whitespace-nowrap text-mute shadow-pop">
          Invio per salvare, Maiusc + Invio per andare a capo, Esc per annullare
        </p>
      </div>
    );
  }
  return (
    <div className="relative">
      <input
        autoFocus
        aria-label="Nuovo valore"
        type={editore.tipo === "numero" ? "number" : editore.tipo === "testo" ? "text" : "date"}
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        onBlur={() => chiudi(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") chiudi(true);
          if (e.key === "Escape") chiudi(false);
        }}
        onFocus={(e) => e.target.select()}
        className={CASELLA}
      />
      <p className="absolute top-[34px] left-0 z-10 rounded-[6px] border border-line bg-background px-2 py-1 text-xs whitespace-nowrap text-mute shadow-pop">
        Invio per salvare, Esc per annullare
      </p>
    </div>
  );
};

export const ElencoScelta = ({ opzioni, valore, svuotabile, onScegli }: { opzioni: Opzione[]; valore: unknown; svuotabile: boolean; onScegli: (v: string | null) => void }) => (
  <div role="listbox" aria-label="Scegli un valore" className="flex max-h-[240px] flex-col overflow-y-auto">
    {opzioni.map((o) => (
      <button key={o.valore} type="button" role="option" aria-selected={o.valore === valore} onClick={() => onScegli(o.valore)} className={cn(VOCE, o.valore === valore && "bg-hover text-ink")}>
        <span className="min-w-0 flex-1 truncate">{o.etichetta}</span>
        {o.valore === valore ? <Check className="text-acc" /> : null}
      </button>
    ))}
    {svuotabile ? (
      <button type="button" onClick={() => onScegli(null)} className={cn(VOCE, "border-t border-line2 text-mute")}>
        Svuota
      </button>
    ) : null}
  </div>
);

export const ElencoMulti = ({ opzioni, scelti, onCambia }: { opzioni: Opzione[]; scelti: string[]; onCambia: (v: string[]) => void }) => (
  <div role="group" aria-label="Scegli i valori" className="flex max-h-[240px] flex-col overflow-y-auto">
    {opzioni.map((o) => (
      <label key={o.valore} className={cn(VOCE, "cursor-pointer")}>
        <input
          type="checkbox"
          className="size-3.5 accent-acc"
          checked={scelti.includes(o.valore)}
          onChange={(e) => onCambia(e.target.checked ? [...scelti, o.valore] : scelti.filter((x) => x !== o.valore))}
        />
        <span className="min-w-0 truncate">{o.etichetta}</span>
      </label>
    ))}
  </div>
);

const Scelte = ({ editore, valore, testoAttuale, onSalva, onAnnulla }: PropsEditore & { testoAttuale: string }) => {
  const multi = editore.tipo === "multi";
  const iniziali = Array.isArray(valore) ? (valore as string[]) : [];
  const [scelti, setScelti] = useState<string[]>(iniziali);
  const chiudi = () => {
    if (multi && scelti.join("\n") !== iniziali.join("\n")) onSalva(scelti);
    else onAnnulla();
  };
  return (
    <Popover open onOpenChange={(a) => !a && chiudi()}>
      <PopoverTrigger className={cn(CASELLA, "truncate text-left")}>{testoAttuale || " "}</PopoverTrigger>
      <PopoverContent align="start" data-editore-cella className="w-[240px] gap-0 p-1.5 shadow-pop">
        {multi ? (
          <ElencoMulti opzioni={editore.opzioni} scelti={scelti} onCambia={setScelti} />
        ) : (
          <ElencoScelta opzioni={editore.opzioni} valore={valore} svuotabile={editore.svuotabile} onScegli={onSalva} />
        )}
      </PopoverContent>
    </Popover>
  );
};

const Legame = ({ editore, valore, testoAttuale, onSalva, onAnnulla }: PropsEditore & { testoAttuale: string }) => {
  const [testo, setTesto] = useState("");
  const { data, isPending } = useGetList<{ id: string; nome: string }>(editore.fra as string, {
    pagination: { page: 1, perPage: 20 },
    sort: { field: "nome", order: "ASC" },
    filter: testo.trim().length >= 2 ? { q: testo.trim() } : {},
  });
  return (
    <Popover open onOpenChange={(a) => !a && onAnnulla()}>
      <PopoverTrigger className={cn(CASELLA, "truncate text-left")}>{testoAttuale || " "}</PopoverTrigger>
      <PopoverContent align="start" data-editore-cella className="w-[280px] gap-0 p-1.5 shadow-pop">
        <label className="mb-1 flex items-center gap-2 border-b border-line2 px-2 pb-1.5">
          <Search className="size-3.5 text-mute-deco" />
          <input
            autoFocus
            aria-label="Cerca"
            placeholder={editore.fra === "aziende" ? "Cerca un'azienda" : "Cerca una persona"}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-cella outline-none"
          />
        </label>
        {isPending ? <p className="animate-pulse px-2 py-1.5 text-mute">...</p> : null}
        <ElencoScelta
          opzioni={(data ?? []).map((r) => ({ valore: r.id, etichetta: r.nome }))}
          valore={valore}
          svuotabile={editore.svuotabile && !!testoAttuale}
          onScegli={onSalva}
        />
      </PopoverContent>
    </Popover>
  );
};

const Valore = ({ riga, testoAttuale, onSalva, onAnnulla }: PropsEditore & { testoAttuale: string; riga?: Record<string, unknown> }) => {
  const [avvio, setAvvio] = useState(riga?.avvio === null || riga?.avvio === undefined ? "" : String(riga.avvio));
  const [canone, setCanone] = useState(riga?.canone === null || riga?.canone === undefined ? "" : String(riga.canone));
  const numero = (v: string) => (v === "" ? null : Number(v));
  return (
    <Popover open onOpenChange={(a) => !a && onAnnulla()}>
      <PopoverTrigger className={cn(CASELLA, "truncate text-left")}>{testoAttuale || " "}</PopoverTrigger>
      <PopoverContent align="start" data-editore-cella className="w-[240px] gap-2 p-3 shadow-pop">
        <label className="flex items-center justify-between gap-2 text-mute">
          Avvio, in euro
          <input autoFocus type="number" aria-label="Avvio" value={avvio} onChange={(e) => setAvvio(e.target.value)} className="h-[30px] w-24 rounded-[6px] border border-line px-2 text-ink" />
        </label>
        <label className="flex items-center justify-between gap-2 text-mute">
          Canone al mese
          <input type="number" aria-label="Canone" value={canone} onChange={(e) => setCanone(e.target.value)} className="h-[30px] w-24 rounded-[6px] border border-line px-2 text-ink" />
        </label>
        <p className="text-xs text-mute">Valore = avvio + 12 mesi di canone</p>
        <Button size="sm" onClick={() => onSalva({ avvio: numero(avvio), canone: numero(canone) })}>
          Salva
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export const EditoreCella = (p: PropsEditore & { testoAttuale: string; riga?: Record<string, unknown> }) => {
  if (p.editore.tipo === "legame") return <Legame {...p} />;
  if (p.editore.tipo === "valore") return <Valore {...p} />;
  if (p.editore.tipo === "istante") {
    return <DataOra apertoSubito etichetta="Nuovo valore" valore={p.valore as string | null} svuotabile={p.editore.svuotabile} onCambia={p.onSalva} onChiudi={p.onAnnulla} className={CASELLA} />;
  }
  return p.editore.tipo === "scelta" || p.editore.tipo === "multi" ? <Scelte {...p} /> : <Casella {...p} />;
};
