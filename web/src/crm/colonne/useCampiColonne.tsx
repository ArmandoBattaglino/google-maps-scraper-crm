import { useMemo } from "react";
import { useGetList } from "ra-core";
import { TUTTE } from "@/crm/scheda/dati";
import { corpoPatch, DEL_TIPO } from "@/crm/viste/Tabella/editor";
import { hrefEmail, hrefTelefono } from "@/crm/persone/campi";
import { Euro, Giorno, Numero, Sito, Testo, Vuoto } from "./celle";
import type { Colonna } from "./useColonne";

interface Definizione {
  chiave: string;
  etichetta: string;
  tipo: string;
  opzioni?: (string | { valore: string })[] | null;
}

const RISORSA = { azienda: "aziende", persona: "persone", trattativa: "trattative" } as const;

const EsceDallaRiga = ({ href, testo }: { href?: string; testo: string }) =>
  href ? (
    <a href={href} onClick={(e) => e.stopPropagation()} className="text-acc-ink hover:underline">
      {testo}
    </a>
  ) : (
    <span className="text-ink2">{testo}</span>
  );

const ValoreCampo = ({ tipo, v }: { tipo: string; v: unknown }) => {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return <Vuoto />;
  if (Array.isArray(v)) return <Testo v={v.join(", ")} />;
  const testo = String(v);
  switch (tipo) {
    case "booleano":
      return <Testo v={v === true ? "Sì" : v === false ? "No" : testo} />;
    case "numero":
      return Number.isFinite(Number(v)) ? <Numero v={testo} /> : <Testo v={testo} />;
    case "valuta":
      return Number.isFinite(Number(v)) ? <Euro v={testo} /> : <Testo v={testo} />;
    case "data":
      return Number.isNaN(Date.parse(testo)) ? <Testo v={testo} /> : <Giorno v={testo} />;
    case "link":
      return <Sito v={testo} />;
    case "telefono":
      return <EsceDallaRiga href={hrefTelefono(testo)} testo={testo} />;
    case "email":
      return <EsceDallaRiga href={hrefEmail(testo)} testo={testo} />;
    default:
      return <Testo v={testo} />;
  }
};

export const useCampiColonne = <R extends { id: string | number; campi?: Record<string, unknown> | null }>(oggetto: "azienda" | "persona" | "trattativa"): Colonna<R>[] => {
  const { data } = useGetList<Definizione & { id: string }>("campi_definizioni", {
    filter: { oggetto, "archiviato_il@is": "null" },
    pagination: TUTTE,
    sort: { field: "ordine", order: "ASC" },
  });
  return useMemo(
    () =>
      (data ?? []).map((d) => ({
        id: `campo:${d.chiave}`,
        etichetta: d.etichetta,
        largo: "max-w-[240px]",
        cella: (r: R) => <ValoreCampo tipo={d.tipo} v={r.campi?.[d.chiave]} />,
        modifica: (r: R) => {
          const tipo = DEL_TIPO[d.tipo];
          if (!tipo) return null;
          const risorsa = RISORSA[oggetto];
          return {
            editore: { tipo, opzioni: (d.opzioni ?? []).map((o) => (typeof o === "string" ? { valore: o, etichetta: o } : { valore: o.valore, etichetta: o.valore })), svuotabile: true },
            valore: r.campi?.[d.chiave],
            scrivi: (v: unknown) => ({ risorsa, id: String(r.id), data: corpoPatch(risorsa, r as never, `campi.${d.chiave}`, v) }),
            applica: (x: R, v: unknown) => ({ ...x, campi: { ...x.campi, [d.chiave]: v } }),
          };
        },
      })),
    [data, oggetto],
  );
};
