import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { Pencil } from "lucide-react";
import { MenuTagCella, type OggettoTag } from "@/crm/tag";
import { messaggioDi } from "@/crm/viste/Barra/forme";
import type { Editore } from "@/crm/viste/Tabella/editor";
import { CASELLA, EditoreCella } from "@/crm/viste/Tabella/Editori";
import { cn } from "@/lib/utils";
import type { DatiCrm } from "@/providers/dati";
import { RILETTE } from "./segue";
import type { Colonna } from "./useColonne";

export interface Destino {
  risorsa: "aziende" | "persone" | "trattative";
  id: string;
  data: Record<string, unknown>;
}

export interface ModificaCella<R> {
  editore: Editore;
  valore: unknown;
  testo?: string;
  rigaEditore?: Record<string, unknown>;
  scrivi?: (v: unknown) => Destino;
  azione?: (v: unknown) => void;
  applica?: (r: R, v: unknown) => R;
  valida?: (v: unknown) => string | null;
  tag?: { oggetto: OggettoTag; id: string };
  dove?: ReactNode;
  soloMatita?: boolean;
}

export type EsitoModifica<R> = ModificaCella<R> | { manca: string } | { soloLettura: string };

const eManca = <R,>(e: EsitoModifica<R> | null | undefined): e is { manca: string } => !!e && "manca" in e;
const eSoloLettura = <R,>(e: EsitoModifica<R> | null | undefined): e is { soloLettura: string } => !!e && "soloLettura" in e;

interface Scritto<R> {
  valore: unknown;
  applica: (r: R, v: unknown) => R;
}

export const useScritture = <R extends { id: string | number }>(righe: R[], chiave: string, onScrittura?: () => void) => {
  const dp = useDataProvider<DatiCrm>();
  const qc = useQueryClient();
  const notify = useNotify();
  const [scritti, setScritti] = useState<Map<string, Scritto<R>>>(new Map());
  const [errori, setErrori] = useState<Map<string, string>>(new Map());
  const [fermo, setFermo] = useState<{ chiave: string; ordine: string[]; toccate: Set<string> } | null>(null);
  const ultime = useRef(new Map<string, R>());
  const delServer = useRef(new Set<string>());
  useEffect(() => {
    delServer.current = new Set(righe.map((r) => String(r.id)));
    for (const r of righe) ultime.current.set(String(r.id), r);
  }, [righe]);
  useEffect(() => {
    setScritti(new Map());
    setErrori(new Map());
  }, [chiave]);

  const valido = fermo?.chiave === chiave ? fermo : null;
  const disposte = useMemo(() => {
    if (!valido) return righe;
    const adesso = new Map(righe.map((r) => [String(r.id), r]));
    const conosciute = new Set(valido.ordine);
    const fuori: R[] = [];
    for (const id of valido.ordine) {
      const r = adesso.get(id) ?? (valido.toccate.has(id) ? ultime.current.get(id) : undefined);
      if (r) fuori.push(r);
    }
    for (const r of righe) if (!conosciute.has(String(r.id))) fuori.push(r);
    return fuori;
  }, [righe, valido]);
  const ultimeDisposte = useRef(disposte);
  useEffect(() => {
    ultimeDisposte.current = disposte;
  }, [disposte]);

  const ferma = useCallback(
    (id: string) => {
      onScrittura?.();
      setFermo((f) =>
        f?.chiave === chiave ? { ...f, toccate: new Set(f.toccate).add(id) } : { chiave, ordine: ultimeDisposte.current.map((r) => String(r.id)), toccate: new Set([id]) },
      );
    },
    [chiave, onScrittura],
  );

  const togli = useCallback(<T,>(set: (f: (m: Map<string, T>) => Map<string, T>) => void, k: string) => {
    set((m) => {
      if (!m.has(k)) return m;
      const n = new Map(m);
      n.delete(k);
      return n;
    });
  }, []);

  const rileggi = useCallback(() => Promise.all(RILETTE.map((queryKey) => qc.invalidateQueries({ queryKey: [queryKey] }))), [qc]);

  const salva = useCallback(
    async (r: R, colonna: string, m: ModificaCella<R>, v: unknown) => {
      const id = String(r.id);
      const k = `${id}|${colonna}`;
      togli(setErrori, k);
      const motivo = m.valida?.(v);
      if (motivo) {
        setErrori((e) => new Map(e).set(k, motivo));
        notify(motivo, { type: "error" });
        return;
      }
      ferma(id);
      if (m.azione) return m.azione(v);
      if (!m.scrivi) return;
      const { applica } = m;
      if (applica) setScritti((s) => new Map(s).set(k, { valore: v, applica }));
      try {
        const d = m.scrivi(v);
        await dp.patch(d.risorsa, { id: d.id, data: d.data });
        await rileggi();
        await new Promise((fatto) => setTimeout(fatto));
        if (delServer.current.has(id)) togli(setScritti, k);
      } catch (e) {
        togli(setScritti, k);
        const messaggio = messaggioDi(e, "Il valore non si è salvato");
        setErrori((x) => new Map(x).set(k, messaggio));
        notify(messaggio, { type: "error" });
      }
    },
    [dp, ferma, notify, rileggi, togli],
  );

  const vista = useCallback(
    (r: R): R => {
      if (!scritti.size) return r;
      let fuori = r;
      for (const [k, s] of scritti) if (k.startsWith(`${String(r.id)}|`)) fuori = s.applica(fuori, s.valore);
      return fuori;
    },
    [scritti],
  );
  const erroreDi = useCallback((r: R, colonna: string) => errori.get(`${String(r.id)}|${colonna}`), [errori]);
  return { disposte, salva, vista, erroreDi, ferma, rileggi };
};

export type Scritture<R extends { id: string | number }> = ReturnType<typeof useScritture<R>>;

const testoDi = (e: Editore, v: unknown) => {
  if (v === null || v === undefined) return "";
  return e.opzioni.find((o) => o.valore === v)?.etichetta ?? String(v);
};

const BASE = "h-riga overflow-hidden border-b border-line2 px-2 text-cella whitespace-nowrap tabular-nums group-hover:bg-riga-hover";
const MODIFICABILE = "group/cella cursor-text outline-none hover:shadow-[inset_0_0_0_1px_var(--line-strong)] focus-visible:shadow-[inset_0_0_0_2px_var(--acc)]";

export const CellaCrm = <R extends { id: string | number }>({
  colonna,
  riga,
  fissa,
  stile,
  classe,
  scritture,
  children,
}: {
  colonna: Colonna<R>;
  riga: R;
  fissa: boolean;
  stile: CSSProperties;
  classe?: string;
  scritture: Scritture<R>;
  children: ReactNode;
}) => {
  const [inModifica, setInModifica] = useState(false);
  const [larghezza, setLarghezza] = useState<number>();
  const notify = useNotify();
  const esito = colonna.modifica?.(riga);
  const manca = eManca(esito) ? esito.manca : undefined;
  const motivoLettura = eSoloLettura(esito) ? esito.soloLettura : undefined;
  const m = esito && !manca && !motivoLettura ? (esito as ModificaCella<R>) : null;
  const errore = scritture.erroreDi(riga, colonna.id);

  if (!m) {
    return (
      <td
        style={stile}
        title={manca ?? motivoLettura}
        data-manca={manca ? "" : undefined}
        className={cn(BASE, classe, manca && "cursor-help")}
        onClick={
          manca
            ? (e: MouseEvent) => {
                if ((e.target as HTMLElement).closest("a")) return;
                e.stopPropagation();
                notify(manca, { type: "info" });
              }
            : undefined
        }
      >
        {children}
      </td>
    );
  }

  const scrivi = (v: unknown) => {
    setInModifica(false);
    if ((v ?? null) === (m.valore ?? null)) return;
    void scritture.salva(riga, colonna.id, m, v);
  };
  const apri = (dentro: Element) => {
    setLarghezza(dentro.closest("td")?.getBoundingClientRect().width);
    setInModifica(true);
  };
  const attiva = (dentro: Element) => {
    if (m.editore.tipo === "booleano") void scritture.salva(riga, colonna.id, m, !m.valore);
    else apri(dentro);
  };
  const chiudiTag = () => {
    setInModifica(false);
    scritture.ferma(String(riga.id));
    void scritture.rileggi();
  };

  if (inModifica) {
    return (
      <td style={stile} data-modifica={colonna.id} onClick={(e) => e.stopPropagation()} className={cn(BASE, classe, !fissa && "relative", "z-[5] overflow-visible px-1")}>
        <div className="relative h-[30px]" style={{ width: larghezza ? larghezza - 8 : undefined }}>
          <div className="absolute top-0 left-0 w-[max(100%,220px)] rounded-[6px] bg-background">
            {m.tag ? (
              <MenuTagCella oggetto={m.tag.oggetto} oggettoId={m.tag.id} testo={m.testo ?? ""} className={cn(CASELLA, "truncate text-left")} onChiudi={chiudiTag} />
            ) : (
              <EditoreCella riga={m.rigaEditore} editore={m.editore} valore={m.valore} testoAttuale={m.testo ?? testoDi(m.editore, m.valore)} onSalva={scrivi} onAnnulla={() => setInModifica(false)} />
            )}
          </div>
        </div>
      </td>
    );
  }
  return (
    <td
      style={stile}
      data-modificabile=""
      data-errore={errore ? "" : undefined}
      title={errore}
      tabIndex={0}
      onClick={(e: MouseEvent) => {
        if (m.soloMatita) return;
        e.stopPropagation();
        if (!(e.target as HTMLElement).closest("a,button")) attiva(e.currentTarget as Element);
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if ((e.key === "Enter" || e.key === "F2") && e.target === e.currentTarget) {
          e.preventDefault();
          attiva(e.currentTarget as Element);
        }
      }}
      className={cn(
        BASE,
        classe,
        !fissa && "relative",
        m.soloMatita ? "group/cella outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--acc)]" : MODIFICABILE,
        errore && "shadow-[inset_0_0_0_1px_var(--danger)]",
      )}
    >
      {m.dove ? (
        <span className="flex min-w-0 items-center">
          <span className="min-w-0 truncate">{children}</span>
          {m.dove}
        </span>
      ) : (
        children
      )}
      {m.editore.tipo === "booleano" ? null : (
        <button
          type="button"
          data-matita
          aria-label={`Modifica ${colonna.etichetta}`}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            apri(e.currentTarget);
          }}
          className="absolute top-1/2 right-0.5 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-sm bg-riga-hover text-mute-deco opacity-0 group-hover/cella:opacity-100 hover:text-ink2"
        >
          <Pencil className="size-3" />
        </button>
      )}
    </td>
  );
};
