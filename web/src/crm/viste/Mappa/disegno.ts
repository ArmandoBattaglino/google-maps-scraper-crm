import type { FeatureCollection, Point } from "geojson";
import { LngLatBounds, setWorkerUrl, type GeoJSONSource, type Map as MapLibre, type StyleSpecification } from "maplibre-gl";
import urlDelWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(urlDelWorker);

export const STILE = "https://tiles.openfreemap.org/styles/positron";
export const ATTRIBUZIONE =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>';

const SORGENTE = "aziende";
const SORGENTE_NUMERI = "aziende-per-i-numeri";
export const GRAPPOLI = "aziende-grappoli";
export const NUMERI = "aziende-numeri";
export const PUNTI = "aziende-punti";

const colore = (nome: string) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

export const fondoPieno = (): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [{ id: "fondo", type: "background", paint: { "background-color": colore("--side") } }],
});

export type Punti = FeatureCollection<Point, { id: string; nome: string }>;

export const puntiDi = (righe: Record<string, unknown>[]): Punti => ({
  type: "FeatureCollection",
  features: righe.map((r) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [Number(r.lng), Number(r.lat)] },
    properties: { id: String(r.id), nome: String(r.nome ?? "") },
  })),
});

export const disegnaPunti = (m: MapLibre, punti: Punti) => {
  if (m.getSource(SORGENTE)) {
    (m.getSource(SORGENTE) as GeoJSONSource).setData(punti);
    (m.getSource(SORGENTE_NUMERI) as GeoJSONSource | undefined)?.setData(punti);
    return;
  }
  const raggruppati = { type: "geojson", data: punti, cluster: true, clusterRadius: 48, clusterMaxZoom: 13 } as const;
  m.addSource(SORGENTE, raggruppati);
  m.addLayer({
    id: GRAPPOLI,
    type: "circle",
    source: SORGENTE,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": colore("--acc"),
      "circle-opacity": 0.88,
      "circle-radius": ["step", ["get", "point_count"], 13, 10, 16, 100, 20, 1000, 25],
      "circle-stroke-width": 2,
      "circle-stroke-color": colore("--bg"),
    },
  });
  m.addLayer({
    id: PUNTI,
    type: "circle",
    source: SORGENTE,
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-color": colore("--acc"), "circle-radius": 6, "circle-stroke-width": 2, "circle-stroke-color": colore("--bg") },
  });
  if (m.getStyle().glyphs) {
    m.addSource(SORGENTE_NUMERI, raggruppati);
    m.addLayer({
      id: NUMERI,
      type: "symbol",
      source: SORGENTE_NUMERI,
      filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-allow-overlap": true },
      paint: { "text-color": colore("--bg") },
    });
  }
};

export const puntiDisegnati = (m: MapLibre): number => {
  if (!m.getLayer(GRAPPOLI)) return 0;
  const visti = new Set<string>();
  let n = 0;
  for (const f of m.queryRenderedFeatures({ layers: [GRAPPOLI, PUNTI] })) {
    const p = f.properties as { cluster_id?: number; point_count?: number; id?: string };
    const k = p.cluster_id !== undefined ? `g${p.cluster_id}` : `p${p.id}`;
    if (visti.has(k)) continue;
    visti.add(k);
    n += p.point_count ?? 1;
  }
  return n;
};

export const inquadra = (m: MapLibre, punti: Punti) => {
  if (!punti.features.length) return;
  const b = new LngLatBounds();
  for (const f of punti.features) b.extend(f.geometry.coordinates as [number, number]);
  m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 0 });
};

export { SORGENTE };
