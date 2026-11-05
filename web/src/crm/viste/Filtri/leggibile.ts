import type { Contesto } from "../contesto";
import { nomeOperatore } from "../etichette";
import type { Condizione, Gruppo, Nodo } from "../stato";
import { DI_GIORNI, eGruppo, figli, legame, SENZA_VALORE } from "./albero";

export const relativo = (v: unknown): string | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const x = v as { da_adesso?: number; da_oggi?: number };
  if (typeof x.da_oggi === "number") {
    if (x.da_oggi === 0) return "oggi";
    if (x.da_oggi === 1) return "domani";
    if (x.da_oggi === -1) return "ieri";
    return x.da_oggi > 0 ? `fra ${x.da_oggi} giorni` : `${-x.da_oggi} giorni fa`;
  }
  if (typeof x.da_adesso === "number") {
    if (x.da_adesso === 0) return "adesso";
    return x.da_adesso > 0 ? `fra ${x.da_adesso} giorni` : `${-x.da_adesso} giorni fa`;
  }
  return null;
};

const giornoLeggibile = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

const unValore = (ctx: Contesto, campo: string, v: unknown): string => {
  if (typeof v === "boolean") return v ? "sì" : "no";
  if (v && typeof v === "object" && "io" in v) return "io";
  const parola = relativo(v);
  if (parola) return parola;
  const tipo = ctx.voce(campo)?.tipo;
  if ((tipo === "data" || tipo === "istante") && typeof v === "string") return giornoLeggibile(v);
  return ctx.etichettaDi(campo, v);
};

export const partiCondizione = (ctx: Contesto, c: Condizione): { campo: string; op: string; valore: string } => {
  const campo = ctx.nome(c.campo).toLowerCase();
  const op = nomeOperatore(c.op, ctx.voce(c.campo)?.tipo);
  if (SENZA_VALORE.has(c.op)) return { campo, op, valore: "" };
  if (DI_GIORNI.has(c.op)) return { campo, op, valore: String(c.valore) };
  if (Array.isArray(c.valore)) {
    return { campo, op, valore: c.valore.map((v) => unValore(ctx, c.campo, v)).join(c.op === "tra" ? " e " : ", ") };
  }
  return { campo, op, valore: unValore(ctx, c.campo, c.valore) };
};

export const testoNodo = (ctx: Contesto, n: Nodo): string => {
  if (!eGruppo(n)) {
    const p = partiCondizione(ctx, n);
    return [p.campo, p.op, p.valore].filter(Boolean).join(" ");
  }
  return testoGruppo(ctx, n);
};

const testoGruppo = (ctx: Contesto, g: Gruppo): string => `(${figli(g).map((x) => testoNodo(ctx, x)).join(legame(g) === "e" ? " e " : " o ")})`;
