import jsonServerProvider from "ra-data-json-server";
import { fetchUtils, HttpError, type DataProvider, type Identifier, type RaRecord } from "ra-core";

export const API_URL = "/crm/api";

type CorpoErrore = { error?: { message?: string; code?: string } };

const httpClient = async (url: string, options: fetchUtils.Options = {}) => {
  const headers = new Headers(options.headers ?? { Accept: "application/json" });
  try {
    return await fetchUtils.fetchJson(url, { ...options, headers, credentials: "same-origin" });
  } catch (e) {
    if (e instanceof HttpError) {
      const corpo = e.body as CorpoErrore | undefined;
      const messaggio = corpo?.error?.message;
      if (messaggio) throw new HttpError(messaggio, e.status, e.body);
    }
    throw e;
  }
};

const base = jsonServerProvider(API_URL, httpClient);

const ELENCHI: Record<string, string> = { aziende: "aziende/elenco", origini: "origini/elenco" };

const totaleDa = (headers: Headers): number | undefined => {
  const x = headers.get("x-total-count");
  if (x !== null && /^\d+$/.test(x)) return Number(x);
  const cr = headers.get("content-range")?.split("/").pop();
  return cr && /^\d+$/.test(cr) ? Number(cr) : undefined;
};

export interface DatiCrm extends DataProvider {
  riprendi: (resource: string, params: { id: Identifier }) => Promise<{ data: RaRecord }>;
  archivia: <R extends RaRecord = RaRecord>(resource: string, params: { id: Identifier }) => Promise<{ data: R }>;
  patch: <R extends RaRecord = RaRecord>(
    resource: string,
    params: { id: Identifier; data: Record<string, unknown> },
  ) => Promise<{ data: R }>;
  ripristina: <R extends RaRecord = RaRecord>(resource: string, params: { id: Identifier }) => Promise<{ data: R }>;
  posta: <T>(percorso: string, corpo: unknown) => Promise<T>;
}

export const dataProvider: DatiCrm = {
  ...base,
  getList: async (resource, params) => {
    const { page, perPage } = params.pagination ?? { page: 1, perPage: 25 };
    const { field, order } = params.sort ?? { field: "id", order: "ASC" };
    const query = {
      ...fetchUtils.flattenObject(params.filter ?? {}),
      _sort: field,
      _order: order,
      _start: (page - 1) * perPage,
      _end: page * perPage,
    };
    const { headers, json } = await httpClient(`${API_URL}/${params.meta?.elenco ? `${resource}/elenco` : (ELENCHI[resource] ?? resource)}?${fetchUtils.queryParameters(query)}`, {
      signal: params.signal,
    });
    const total = totaleDa(headers);
    if (total === undefined) throw new HttpError("l'API non ha detto il totale (X-Total-Count o Content-Range)", 500);
    return { data: json, total };
  },
  posta: async <T,>(percorso: string, corpo: unknown) => {
    const { json } = await httpClient(`${API_URL}/${percorso}`, { method: "POST", body: JSON.stringify(corpo) });
    return json as T;
  },
  riprendi: async (resource, { id }) => {
    const { json } = await httpClient(`${API_URL}/${resource}/${encodeURIComponent(String(id))}/riprendi`, { method: "POST" });
    return { data: json };
  },
  archivia: async (resource, { id }) => {
    const { json } = await httpClient(`${API_URL}/${resource}/${encodeURIComponent(String(id))}/archivia`, {
      method: "POST",
    });
    return { data: json };
  },
  patch: async (resource, { id, data }) => {
    const { json } = await httpClient(`${API_URL}/${resource}/${encodeURIComponent(String(id))}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return { data: json };
  },
  ripristina: async (resource, { id }) => {
    const { json } = await httpClient(`${API_URL}/${resource}/${encodeURIComponent(String(id))}/ripristina`, {
      method: "POST",
    });
    return { data: json };
  },
};
