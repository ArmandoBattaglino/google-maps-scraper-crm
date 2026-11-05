import { dataProvider } from "@/providers/dati";

export interface Doppione {
  id: string;
  nome: string;
  comune?: string;
  chiave: Chiave;
}
export type Chiave = "place_id" | "piva" | "telefono" | "sito" | "email" | "nome";
export type CampiChiave = Partial<Record<Chiave, string>>;

export const NOME_CHIAVE: Record<Chiave, string> = {
  place_id: "stessa scheda di Maps",
  telefono: "stesso telefono",
  piva: "stessa partita IVA",
  sito: "stesso sito",
  email: "stessa email",
  nome: "stesso nome",
};

export const normaTelefono = (t: string): string => {
  const x = t.replace(/\D/g, "");
  if (x.length < 6) return "";
  if (x.startsWith("0039")) return x.slice(2);
  if (x.startsWith("39") && x.length >= 11) return x;
  return `39${x}`;
};

export const verificaDoppioni = async (campi: CampiChiave, escludi?: string): Promise<Doppione[]> => {
  const piene = Object.entries(campi).filter(([, v]) => v?.trim());
  if (!piene.length) return [];
  const { aziende } = await dataProvider.posta<{ aziende: Doppione[] }>("aziende/verifica", {
    ...Object.fromEntries(piene),
    ...(escludi ? { escludi } : {}),
  });
  return aziende;
};
