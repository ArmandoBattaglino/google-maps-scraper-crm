import type { AuthProvider, UserIdentity } from "ra-core";

export const IO_URL = "/crm/api/io";

export interface Io {
  email: string;
  socio: boolean;
  nome?: string;
}

export class ErroreIo extends Error {
  constructor(public stato: number) {
    super(`/crm/api/io ha risposto ${stato || "senza rete"}`);
  }
}

let inCorso: Promise<Io> | null = null;

export const leggiIo = (): Promise<Io> => {
  inCorso ??= (async () => {
    let risposta: Response;
    try {
      risposta = await fetch(IO_URL, { credentials: "same-origin", headers: { Accept: "application/json" } });
    } catch {
      throw new ErroreIo(0);
    }
    if (!risposta.ok) throw new ErroreIo(risposta.status);
    const io = (await risposta.json()) as Partial<Io>;
    return { email: io.email ?? "", socio: io.socio === true, nome: io.nome };
  })().catch((e) => {
    inCorso = null;
    throw e;
  });
  return inCorso;
};

const nessuno: UserIdentity = { id: "", fullName: "" };

export const authProvider: AuthProvider = {
  login: () => Promise.resolve(),
  checkAuth: () => Promise.resolve(),
  checkError: () => Promise.resolve(),
  getIdentity: async () => {
    try {
      const io = await leggiIo();
      if (!io.email) return nessuno;
      return { id: io.email, fullName: io.nome || io.email };
    } catch {
      return nessuno;
    }
  },
  logout: () => Promise.resolve(false),
  getPermissions: () => Promise.resolve(),
};
