import type { FaseRiga } from "@/crm/trattative/tipi";
import type { Contesto } from "../contesto";
import type { RigaVista } from "../dati";
import { editoreDi } from "../Tabella/editor";

export const SENZA_VALORE = "__vuoto__";
export const FASE = "fase_id";

export const buonoPerColonne = (ctx: Contesto, campo: string): boolean => campo === FASE || editoreDi(ctx, campo)?.tipo === "scelta";

export const campoDelleColonne = (ctx: Contesto, gruppi: string[]): string | undefined => {
  if (gruppi[0] && ctx.voce(gruppi[0]) && buonoPerColonne(ctx, gruppi[0])) return gruppi[0];
  if (ctx.voce(FASE)) return FASE;
  if (ctx.voce("stato")) return "stato";
  return ctx.campi.find((c) => buonoPerColonne(ctx, c.campo))?.campo;
};

export const colonneDelleFasi = (fasi: FaseRiga[], percorsi: { id: string; nome: string }[], righe: RigaVista[]): FaseRiga[] => {
  const usati = new Set(righe.map((r) => String(r.percorso)));
  const scelte = usati.size ? fasi.filter((f) => usati.has(f.percorso)) : fasi;
  const posto = new Map(percorsi.map((p, i) => [p.id, i]));
  const conti = new Map<string, number>();
  for (const f of scelte) conti.set(f.nome, (conti.get(f.nome) ?? 0) + 1);
  return [...scelte]
    .sort((a, b) => (posto.get(a.percorso) ?? 0) - (posto.get(b.percorso) ?? 0) || a.ordine - b.ordine)
    .map((f) => ((conti.get(f.nome) ?? 0) > 1 ? { ...f, nome: `${f.nome} (${percorsi.find((p) => p.id === f.percorso)?.nome ?? f.percorso})` } : f));
};

export const colonneDelCampo = (ctx: Contesto, campo: string, valori: unknown[]): FaseRiga[] => {
  const opzioni = ctx.opzioniDi(campo) ?? [];
  const note = new Set(opzioni.map((o) => o.valore));
  const orfani = [...new Set(valori.filter((v): v is string => typeof v === "string" && !!v && !note.has(v)))];
  const presenti = new Set(valori);
  const voci = [...(campo === "stato" ? opzioni.filter((o) => presenti.has(o.valore)) : opzioni), ...orfani.map((v) => ({ valore: v, etichetta: v }))];
  const colonna = (id: string, nome: string, ordine: number): FaseRiga => ({ id, nome, ordine, tipo: "aperta", percorso: "" });
  return [...voci.map((o, i) => colonna(o.valore, o.etichetta, i)), ...(editoreDi(ctx, campo)?.svuotabile ? [colonna(SENZA_VALORE, "Senza valore", voci.length)] : [])];
};
