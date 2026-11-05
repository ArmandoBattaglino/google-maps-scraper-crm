import { Fragment, useContext, useMemo, type CSSProperties } from "react";
import { AzioniRiga, CellaPuntini, TestataPuntini } from "@/crm/azioni/MenuRiga";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { larghezzeTabella, ManigliaLarghezza, stileColonna, useSpostaColonne } from "@/crm/colonne/testate";
import { cn } from "@/lib/utils";
import { useContesto } from "../contesto";
import type { RigaVista } from "../dati";
import { valoreDi } from "../formato";
import { gruppoColonna } from "../gruppiCampi";
import type { Colonna, Ordine, Risorsa } from "../stato";
import { Cella } from "./Cella";

export type ColonnaRiga = ColumnDef<RigaVista>;

export const useColonne = (colonne: Colonna[]): ColonnaRiga[] => {
  const { risorsa } = useContesto();
  return useMemo(() => {
    const inizi = new Set(gruppiDelleColonne(colonne, risorsa).slice(1).map((g) => g.colonne[0].campo));
    return colonne.map((c, i) => ({
      id: c.campo,
      accessorFn: (r: RigaVista) => valoreDi(r, c.campo),
      cell: ({ row }) => <Cella riga={row.original} campo={c.campo} prima={i === 0} inizioGruppo={inizi.has(c.campo)} />,
    }));
  }, [colonne, risorsa]);
};

export const gruppiDelleColonne = (colonne: Colonna[], risorsa: Risorsa) => {
  const tratti: { gruppo: ReturnType<typeof gruppoColonna>; colonne: Colonna[] }[] = [];
  for (const c of colonne) {
    const gruppo = gruppoColonna(c.campo, risorsa);
    const ultimo = tratti.at(-1);
    if (ultimo?.gruppo.chiave === gruppo.chiave) ultimo.colonne.push(c);
    else tratti.push({ gruppo, colonne: [c] });
  }
  return tratti;
};

export const stileTabella = (colonne: Colonna[]): CSSProperties =>
  larghezzeTabella(colonne.map((c) => ({ chiave: c.campo, larghezza: c.larghezza })));

export const useTabella = (righe: RigaVista[], colonne: ColonnaRiga[]) =>
  useReactTable({ data: righe, columns: colonne, getCoreRowModel: getCoreRowModel(), getRowId: (r) => r.id });

export const Testate = ({
  colonne,
  ordine,
  onOrdina,
  onColonne,
}: {
  colonne: Colonna[];
  ordine: Ordine[];
  onOrdina: (o: Ordine[]) => void;
  onColonne: (c: Colonna[]) => void;
}) => {
  const ctx = useContesto();
  const tratti = gruppiDelleColonne(colonne, ctx.risorsa);
  const conGruppi = tratti.length > 1;
  const inizi = new Set(tratti.slice(1).map((t) => t.colonne[0].campo));
  const { propsDi, segnoDi } = useSpostaColonne(
    colonne.map((c) => c.campo),
    (chiavi) => onColonne(chiavi.map((k) => colonne.find((c) => c.campo === k) as Colonna)),
  );
  const conLarghezza = (campo: string, larghezza: number | undefined) =>
    onColonne(colonne.map((c) => (c.campo === campo ? { ...c, larghezza } : c)));
  return (
    <thead>
      {conGruppi ? (
        <tr data-gruppi-colonne>
          {tratti.map((t, i) => {
            const Icona = t.gruppo.icona;
            return (
              <th
                key={`${t.gruppo.chiave}-${i}`}
                scope="colgroup"
                colSpan={t.colonne.length}
                data-gruppo-colonne={t.gruppo.chiave}
                className={cn(
                  "sticky top-0 z-[2] h-7 border-b border-line2 bg-background px-2 text-left text-xs font-medium whitespace-nowrap text-mute",
                  i > 0 && "border-l border-line",
                )}
              >
                <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:text-mute-deco">
                  <Icona />
                  {t.gruppo.breve}
                </span>
              </th>
            );
          })}
          <th className="sticky top-0 right-0 z-[2] border-b border-line2 bg-background" />
        </tr>
      ) : null}
      <tr>
        {colonne.map((c) => {
          const perOrdine = c.campo === "fase.nome" ? "fase.ordine" : c.campo;
          const attuale = ordine.find((o) => o.campo === perOrdine);
          const ordinabile = ctx.voce(c.campo)?.ordinabile;
          return (
            <th
              key={c.campo}
              scope="col"
              data-testata={c.campo}
              {...propsDi(c.campo)}
              style={stileColonna(c.campo, "none")}
              aria-sort={attuale ? (attuale.dir === "asc" ? "ascending" : "descending") : undefined}
              className={cn(
                "sticky z-[2] cursor-grab border-b border-line bg-background px-2 py-2 text-left font-medium whitespace-nowrap text-mute active:cursor-grabbing",
                conGruppi ? "top-7" : "top-0",
                inizi.has(c.campo) && "border-l border-l-line",
                segnoDi(c.campo),
              )}
            >
              {ordinabile ? (
                <button
                  type="button"
                  title={attuale ? "Clic per invertire l'ordine" : "Clic per ordinare"}
                  className="group/ordina inline-flex items-center gap-1 outline-none hover:text-ink focus-visible:text-ink [&_svg]:size-3"
                  onClick={() => onOrdina([{ campo: perOrdine, dir: attuale?.dir === "asc" ? "desc" : "asc" }])}
                >
                  {ctx.nome(c.campo)}
                  {attuale ? attuale.dir === "asc" ? <ArrowUp /> : <ArrowDown /> : <ArrowUpDown className="opacity-0 group-hover/ordina:opacity-100" />}
                </button>
              ) : (
                ctx.nome(c.campo)
              )}
              <ManigliaLarghezza chiave={c.campo} nome={ctx.nome(c.campo)} onLarghezza={(l) => conLarghezza(c.campo, l)} />
            </th>
          );
        })}
        <TestataPuntini sopra={conGruppi ? "top-7" : "top-0"} />
      </tr>
    </thead>
  );
};

export const RigheTabella = ({ tabella }: { tabella: Table<RigaVista> }) => {
  const azioni = useContext(AzioniRiga);
  const perMenu = (r: RigaVista) => ({ id: r.id, nome: String(r.nome ?? r["azienda.nome"] ?? r["persona.nome"] ?? ""), archiviata_il: r.archiviata_il });
  return (
    <>
      {tabella.getRowModel().rows.map((r) => (
        <tr key={r.id} data-riga={r.id} className="group hover:bg-riga-hover" onContextMenu={azioni ? (e) => azioni(e, perMenu(r.original)) : undefined}>
          {r.getVisibleCells().map((c) => (
            <Fragment key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</Fragment>
          ))}
          <CellaPuntini onApri={azioni ? (e) => azioni(e, perMenu(r.original)) : undefined} />
        </tr>
      ))}
    </>
  );
};
