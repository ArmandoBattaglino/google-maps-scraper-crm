import { useGetList } from "ra-core";
import { SlidersHorizontal } from "lucide-react";
import { Campo } from "./Campo";
import type { Opzione, TipoCampo } from "./Editor";
import { GrigliaCampi } from "./Scheda";
import { TUTTE } from "./dati";

interface Definizione {
  id: string;
  chiave: string;
  etichetta: string;
  tipo: string;
  opzioni: (string | { valore: string })[];
}

const TIPI: Record<string, TipoCampo> = { numero: "numero", valuta: "numero", data: "data", scelta: "scelta", booleano: "scelta" };
const SI_NO: Opzione[] = [
  { id: "true", name: "Sì" },
  { id: "false", name: "No" },
];

const opzioniDi = (d: Definizione): Opzione[] => {
  if (d.tipo === "booleano") return SI_NO;
  return d.opzioni.map((o) => {
    const v = typeof o === "string" ? o : o.valore;
    return { id: v, name: v };
  });
};

const perCampo = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
};

const perDb = (tipo: string, v: string): unknown => {
  if (!v.trim()) return null;
  if (tipo === "numero" || tipo === "valuta") return Number(v);
  if (tipo === "booleano") return v === "true";
  if (tipo === "multi") return v.split(",").map((x) => x.trim()).filter(Boolean);
  return v;
};

const collegamento = (tipo: string, v: string) => {
  if (!v) return undefined;
  if (tipo === "link") return v;
  if (tipo === "telefono") return `tel:${v.replace(/[^\d+]/g, "")}`;
  if (tipo === "email") return `mailto:${v}`;
  return undefined;
};

export const CampiPersonalizzati = ({
  oggetto,
  valori,
  onSalva,
}: {
  oggetto: "azienda" | "persona" | "trattativa";
  valori: Record<string, unknown>;
  onSalva: (campi: Record<string, unknown>) => Promise<unknown>;
}) => {
  const { data } = useGetList<Definizione>("campi_definizioni", {
    filter: { oggetto, "archiviato_il@is": "null" },
    pagination: TUTTE,
    sort: { field: "ordine", order: "ASC" },
  });
  if (!data?.length) return null;
  return (
    <section className="mt-3.5 border-t border-dashed border-line pt-3" data-sezione="campi">
      <h3 className="text-xs font-medium text-mute">Campi personalizzati</h3>
      <GrigliaCampi stretta>
        {data.map((d) => {
          const valore = perCampo(valori[d.chiave]);
          return (
            <Campo
              key={d.id}
              nome={`campi.${d.chiave}`}
              etichetta={d.etichetta}
              icona={<SlidersHorizontal />}
              tipo={TIPI[d.tipo] ?? "testo"}
              opzioni={opzioniDi(d)}
              valore={valore}
              href={collegamento(d.tipo, valore)}
              mostra={d.tipo === "booleano" && valore ? (valore === "true" ? "Sì" : "No") : undefined}
              onSalva={(v) => onSalva({ ...valori, [d.chiave]: perDb(d.tipo, v) })}
            />
          );
        })}
      </GrigliaCampi>
    </section>
  );
};
