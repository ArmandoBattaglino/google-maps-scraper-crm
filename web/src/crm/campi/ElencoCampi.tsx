import { useState, type DragEvent, type MouseEvent } from "react";
import { Archive, ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Chip } from "@/components/crm/forme";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { tipoDi, valoreDi, type Definizione } from "./tipi";

const MAX_CHIP = 3;

const sposta = (lista: Definizione[], da: number, a: number) => {
  const copia = [...lista];
  const [preso] = copia.splice(da, 1);
  copia.splice(a, 0, preso);
  return copia;
};

const OpzioniInRiga = ({ campo }: { campo: Definizione }) => {
  const valori = campo.opzioni.map(valoreDi);
  return (
    <span className="flex items-center gap-1 overflow-hidden">
      {valori.slice(0, MAX_CHIP).map((v) => (
        <Chip key={v}>
          <span className="max-w-[110px] truncate">{v}</span>
        </Chip>
      ))}
      {valori.length > MAX_CHIP ? <span className="text-xs text-mute tabular-nums">+{valori.length - MAX_CHIP}</span> : null}
    </span>
  );
};

type Bersaglio = { id: string; dopo: boolean };

export const ElencoCampi = ({
  campi,
  scelto,
  onApri,
  onRiordina,
  onArchivia,
}: {
  campi: Definizione[];
  scelto?: string;
  onApri: (campo: Definizione) => void;
  onRiordina: (lista: Definizione[]) => void;
  onArchivia: (campo: Definizione) => void;
}) => {
  const [preso, setPreso] = useState<string | null>(null);
  const [bersaglio, setBersaglio] = useState<Bersaglio | null>(null);

  const passaSopra = (e: DragEvent<HTMLTableRowElement>, id: string) => {
    if (!preso) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setBersaglio({ id, dopo: e.clientY > r.top + r.height / 2 });
  };

  const lascia = (e: DragEvent) => {
    e.preventDefault();
    if (preso && bersaglio && preso !== bersaglio.id) {
      const da = campi.findIndex((c) => c.id === preso);
      const su = campi.findIndex((c) => c.id === bersaglio.id);
      const a = (bersaglio.dopo ? su + 1 : su) - (da < su ? 1 : 0);
      if (da >= 0 && su >= 0 && a !== da) onRiordina(sposta(campi, da, a));
    }
    setPreso(null);
    setBersaglio(null);
  };

  const azione = (fai: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fai();
  };

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-7 pr-0">
            <span className="sr-only">Sposta</span>
          </TableHead>
          <TableHead className="sm:w-[36%]">Campo</TableHead>
          <TableHead className="w-[120px] sm:w-[140px]">Tipo</TableHead>
          <TableHead className="max-sm:hidden">Opzioni</TableHead>
          <TableHead className="w-[104px]">
            <span className="sr-only">Azioni</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campi.map((c, i) => {
          const Icona = tipoDi(c.tipo).icona;
          const qui = bersaglio?.id === c.id && preso !== c.id;
          return (
            <TableRow
              key={c.id}
              data-campo={c.chiave}
              data-state={scelto === c.id ? "selected" : undefined}
              onClick={() => onApri(c)}
              onDragOver={(e) => passaSopra(e, c.id)}
              onDrop={lascia}
              className={cn(
                "group/riga cursor-pointer",
                preso === c.id && "opacity-40",
                qui && !bersaglio?.dopo && "[&>td]:shadow-[inset_0_2px_0_var(--acc)]",
                qui && bersaglio?.dopo && "[&>td]:shadow-[inset_0_-2px_0_var(--acc)]",
              )}
            >
              <TableCell className="pr-0 pl-1.5">
                <span
                  draggable
                  data-maniglia
                  title="Trascina per spostare"
                  onClick={(e) => e.stopPropagation()}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", c.chiave);
                    const riga = e.currentTarget.closest("tr");
                    if (riga) e.dataTransfer.setDragImage(riga, 12, 19);
                    setPreso(c.id);
                  }}
                  onDragEnd={() => {
                    setPreso(null);
                    setBersaglio(null);
                  }}
                  className="grid size-5 cursor-grab place-items-center rounded-sm text-mute-deco hover:bg-hover hover:text-ink2 active:cursor-grabbing"
                >
                  <GripVertical className="size-3.5" />
                </span>
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  data-nome
                  onClick={azione(() => onApri(c))}
                  className="block max-w-full truncate rounded-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-acc-soft"
                >
                  {c.etichetta}
                </button>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-ink2">
                  <Icona className="size-3.5 text-mute-deco" />
                  {tipoDi(c.tipo).nome}
                </span>
              </TableCell>
              <TableCell className="max-sm:hidden">
                <OpzioniInRiga campo={c} />
              </TableCell>
              <TableCell className="px-1 text-right">
                <span data-azioni className="inline-flex opacity-0 transition-opacity group-hover/riga:opacity-100 group-focus-within/riga:opacity-100 group-data-[state=selected]/riga:opacity-100 [@media(hover:none)]:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Sposta su ${c.etichetta}`}
                    disabled={i === 0}
                    onClick={azione(() => onRiordina(sposta(campi, i, i - 1)))}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Sposta giù ${c.etichetta}`}
                    disabled={i === campi.length - 1}
                    onClick={azione(() => onRiordina(sposta(campi, i, i + 1)))}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Archivia ${c.etichetta}`}
                    title="Archivia: sparisce dalle schede, i valori restano"
                    onClick={azione(() => onArchivia(c))}
                  >
                    <Archive />
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
