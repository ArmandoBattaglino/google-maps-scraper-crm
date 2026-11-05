import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  DataEditor,
  GridCellKind,
  type CellClickedEventArgs,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type GridMouseEventArgs,
  type Item,
  type ProvideEditorCallback,
  type Rectangle,
  type Theme,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { messaggioDi } from "../Barra/forme";
import { gruppoColonna } from "../gruppiCampi";
import { useContesto } from "../contesto";
import { cerca, colonneDi, type RigaVista } from "../dati";
import { pulisci } from "../Filtri/albero";
import { Errore } from "../forme";
import { TESTO_INTERO, testoSegni, testoValore } from "../formato";
import type { StatoPagina } from "../useStatoVista";
import { calcolatoQui, editoreDi, eFase } from "./editor";
import { editoreDellaGriglia } from "./EditoreGriglia";
import { schedaDi } from "./Mostra";
import { useModifica } from "./useModifica";

const BLOCCO = 500;
const DOPPIO_CLIC_MS = 220;
const ANTICIPO = 100;
const CARICAMENTO: GridCell = { kind: GridCellKind.Loading, allowOverlay: false };
const SPERIMENTALE = { renderStrategy: "direct" } as const;

const temaDelCrm = (): Partial<Theme> => {
  const css = getComputedStyle(document.documentElement);
  const c = (nome: string) => css.getPropertyValue(nome).trim();
  return {
    accentColor: c("--acc"),
    accentFg: c("--bg"),
    accentLight: c("--acc-soft"),
    textDark: c("--ink"),
    textMedium: c("--ink2"),
    textLight: c("--mute"),
    textBubble: c("--ink2"),
    textHeader: c("--mute"),
    textHeaderSelected: c("--bg"),
    bgIconHeader: c("--mute"),
    fgIconHeader: c("--bg"),
    bgCell: c("--bg"),
    bgCellMedium: c("--row-hover"),
    bgHeader: c("--bg"),
    bgHeaderHasFocus: c("--hover"),
    bgHeaderHovered: c("--hover"),
    bgBubble: c("--hover"),
    bgBubbleSelected: c("--bg"),
    bgSearchResult: c("--warn-soft"),
    borderColor: c("--line2"),
    linkColor: c("--acc-ink"),
    fontFamily: "Inter, sans-serif",
    baseFontStyle: "12.5px",
    headerFontStyle: "500 13px",
    editorFontSize: "12.5px",
  };
};

export default function Griglia({ pagina, totale }: { pagina: StatoPagina; totale: number }) {
  const { stato, cambia } = pagina;
  const ctx = useContesto();
  const { valore: valoreDi, salva } = useModifica();
  const [blocchi, setBlocchi] = useState<number[]>([0]);
  const tema = useMemo(temaDelCrm, []);
  const portale = useRef<HTMLDivElement>(null);
  const contenitore = useRef<HTMLDivElement>(null);
  const [anteprima, setAnteprima] = useState<Record<string, number>>({});
  const campi = useMemo(() => stato.colonne.map((c) => c.campo), [stato.colonne]);
  const richiesta = useMemo(
    () => ({ filtri: pulisci(stato.filtri), ordine: stato.ordine, colonne: colonneDi(stato) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stato cambia con questi pezzi
    [stato.filtri, stato.ordine, stato.colonne, stato.gruppi, stato.campo_data],
  );
  useEffect(() => setBlocchi([0]), [richiesta]);

  const risultati = useQueries({
    queries: blocchi.map((b) => ({
      queryKey: [stato.risorsa, "cerca", "griglia", richiesta, b],
      queryFn: ({ signal }: { signal: AbortSignal }) => cerca(stato.risorsa, { ...richiesta, inizio: b * BLOCCO, quanti: BLOCCO }, signal),
      retry: false,
      staleTime: 5000,
      structuralSharing: false,
    })),
  });
  const errore = risultati.find((r) => r.error)?.error;
  const versione = risultati.map((r) => r.dataUpdatedAt).join();
  const rigaA = useMemo(() => {
    const perBlocco = new Map(blocchi.map((b, i) => [b, risultati[i]?.data?.righe]));
    return (r: number): RigaVista | undefined => perBlocco.get(Math.floor(r / BLOCCO))?.[r % BLOCCO];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- risultati è nuovo a ogni disegno, versione no
  }, [blocchi, versione]);

  const colonne = useMemo<GridColumn[]>(
    () => {
      const piuEntita = new Set(campi.map((campo) => gruppoColonna(campo, stato.risorsa).chiave)).size > 1;
      return campi.map((campo, i) => {
        const o = stato.ordine.find((x) => x.campo === campo);
        return { id: campo, title: `${ctx.nome(campo)}${o ? (o.dir === "asc" ? " ↑" : " ↓") : ""}`, width: anteprima[campo] ?? stato.colonne[i].larghezza ?? (i === 0 ? 240 : 170), ...(piuEntita ? { group: gruppoColonna(campo, stato.risorsa).breve } : {}) };
      });
    },
    [campi, ctx, stato.ordine, stato.colonne, stato.risorsa, anteprima],
  );

  const editori = useMemo(() => campi.map((campo) => {
    const e = editoreDi(ctx, campo);
    return e && e.tipo !== "legame" && e.tipo !== "valore" && !eFase(campo) ? e : null;
  }), [campi, ctx]);

  const costruisci = useCallback(
    (riga: RigaVista, c: number): GridCell => {
      const campo = campi[c];
      const editore = calcolatoQui(ctx.risorsa, riga, campo) ? null : editori[c];
      const v = valoreDi(riga, campo);
      if (editore?.tipo === "booleano") return { kind: GridCellKind.Boolean, data: v === true, allowOverlay: false, readonly: false };
      const testo = testoValore(ctx, campo, v) + (campo === "stato" ? testoSegni(riga.stato_segni) : "");
      if (editore?.tipo === "numero") {
        return { kind: GridCellKind.Number, data: v === null || v === undefined ? undefined : Number(v), displayData: testo, allowOverlay: true };
      }
      return { kind: GridCellKind.Text, data: Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v), displayData: testo, allowOverlay: !!editore, readonly: !editore };
    },
    [campi, editori, ctx, valoreDi],
  );

  const celle = useMemo(() => {
    void costruisci;
    return new WeakMap<RigaVista, GridCell[]>();
  }, [costruisci]);

  const getCellContent = useCallback(
    ([c, r]: Item): GridCell => {
      const riga = rigaA(r);
      if (!riga) return CARICAMENTO;
      let fila = celle.get(riga);
      if (!fila) {
        fila = [];
        celle.set(riga, fila);
      }
      return (fila[c] ??= costruisci(riga, c));
    },
    [rigaA, celle, costruisci],
  );

  const onCellEdited = useCallback(
    ([c, r]: Item, nuovo: EditableGridCell) => {
      const riga = rigaA(r);
      if (!riga) return;
      if (nuovo.kind === GridCellKind.Text || nuovo.kind === GridCellKind.Number || nuovo.kind === GridCellKind.Boolean) {
        void salva(riga, campi[c], nuovo.kind === GridCellKind.Number ? (nuovo.data ?? null) : nuovo.data);
      }
    },
    [rigaA, campi, salva],
  );

  const perEditore = useRef({ campi, rigaA, editori, valoreDi, salva });
  perEditore.current = { campi, rigaA, editori, valoreDi, salva };
  const provideEditor = useCallback<ProvideEditorCallback<GridCell>>((cella) => {
    const posto = (cella as GridCell & { location?: Item }).location;
    if (!posto) return undefined;
    const q = perEditore.current;
    const campo = q.campi[posto[0]];
    const riga = q.rigaA(posto[1]);
    const editore = q.editori[posto[0]];
    if (!riga || !editore) return undefined;
    return editoreDellaGriglia(editore, q.valoreDi(riga, campo), (v) => void perEditore.current.salva(riga, campo, v));
  }, []);

  const onVisibleRegionChanged = useCallback((r: Rectangle) => {
    const da = Math.floor(Math.max(0, r.y - ANTICIPO) / BLOCCO);
    const a = Math.floor((r.y + r.height + ANTICIPO) / BLOCCO);
    setBlocchi((attuali) => {
      const nuovi = Array.from({ length: a - da + 1 }, (_, i) => da + i);
      return nuovi.join() === attuali.join() ? attuali : nuovi;
    });
  }, []);

  const onItemHovered = useCallback(
    (a: GridMouseEventArgs) => {
      if (!contenitore.current) return;
      const campo = a.kind === "cell" ? campi[a.location[0]] : undefined;
      const v = campo && TESTO_INTERO.has(campo) ? rigaA(a.location[1])?.[campo] : null;
      contenitore.current.title = typeof v === "string" ? v : "";
    },
    [campi, rigaA],
  );

  const onHeaderClicked = useCallback(
    (c: number) => {
      const campo = campi[c];
      if (!ctx.voce(campo)?.ordinabile) return;
      const attuale = stato.ordine.find((o) => o.campo === campo);
      cambia({ ordine: [{ campo, dir: attuale?.dir === "asc" ? "desc" : "asc" }] });
    },
    [campi, ctx, stato.ordine, cambia],
  );

  const navigate = useNavigate();
  const clicInAttesa = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (clicInAttesa.current) clearTimeout(clicInAttesa.current);
  }, []);
  const onCellClicked = useCallback(
    ([c, r]: Item, e: CellClickedEventArgs) => {
      if (clicInAttesa.current) {
        clearTimeout(clicInAttesa.current);
        clicInAttesa.current = null;
        return;
      }
      const riga = rigaA(r);
      const scheda = riga ? schedaDi(stato.risorsa, riga) : null;
      if (c !== 0 || !riga || !scheda) return;
      if (e.ctrlKey || e.metaKey) {
        if (stato.risorsa !== "attivita") window.open(`/crm/${stato.risorsa}/${riga.id}`, "_blank", "noopener");
        return;
      }
      clicInAttesa.current = setTimeout(() => {
        clicInAttesa.current = null;
        navigate(scheda);
      }, DOPPIO_CLIC_MS);
    },
    [rigaA, stato.risorsa, navigate],
  );

  if (errore) return <Errore messaggio={messaggioDi(errore, "Le righe non si sono caricate.")} />;
  return (
    <div ref={contenitore} className="relative mx-5 min-h-0 flex-1 border-t border-line" data-griglia="glide" data-righe={totale}>
      <DataEditor
        width="100%"
        height="100%"
        rows={totale}
        columns={colonne}
        onColumnResize={(c, w) => setAnteprima((a) => ({ ...a, [String(c.id)]: w }))}
        onColumnResizeEnd={(c, w) => {
          pagina.sistemaColonne(stato.colonne.map((x) => (x.campo === c.id ? { ...x, larghezza: Math.round(w) } : x)));
          setAnteprima({});
        }}
        onColumnMoved={(da, a) => {
          const copia = [...stato.colonne];
          copia.splice(a, 0, ...copia.splice(da, 1));
          pagina.sistemaColonne(copia);
        }}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        provideEditor={provideEditor}
        onVisibleRegionChanged={onVisibleRegionChanged}
        onItemHovered={onItemHovered}
        onHeaderClicked={onHeaderClicked}
        onCellClicked={onCellClicked}
        portalElementRef={portale as RefObject<HTMLElement>}
        theme={tema}
        rowHeight={38}
        headerHeight={34}
        rowMarkers="none"
        experimental={SPERIMENTALE}
        verticalBorder={false}
      />
      <div ref={portale} className="fixed top-0 left-0 z-50" />
    </div>
  );
}
