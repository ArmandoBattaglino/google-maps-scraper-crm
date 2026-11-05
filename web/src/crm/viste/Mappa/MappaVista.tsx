import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Point } from "geojson";
import { AttributionControl, Map as MapLibre, NavigationControl, Popup, type GeoJSONSource, type MapGeoJSONFeature, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router";
import { messaggioDi } from "../Barra/forme";
import { leggiFinoA, useCerca } from "../dati";
import { conAncheFiltro, pulisci } from "../Filtri/albero";
import { Errore, Puntini } from "../forme";
import type { Gruppo, Risorsa } from "../stato";
import type { StatoPagina } from "../useStatoVista";
import "../viste.css";
import { ATTRIBUZIONE, disegnaPunti, fondoPieno, GRAPPOLI, inquadra, PUNTI, puntiDi, puntiDisegnati, SORGENTE, STILE, type Punti } from "./disegno";

const MASSIMO = 20_000;
const numeri = new Intl.NumberFormat("it-IT", { useGrouping: true });
const campiDi = (r: Risorsa) => {
  const lat = r === "aziende" ? "lat" : "azienda.lat";
  const lng = r === "aziende" ? "lng" : "azienda.lng";
  const nome = r === "aziende" || r === "persone" ? "nome" : "azienda.nome";
  return { lat, lng, nome };
};

export default function MappaVista({ pagina }: { pagina: StatoPagina }) {
  const { stato, cambia } = pagina;
  const navigate = useNavigate();
  const contenitore = useRef<HTMLDivElement>(null);
  const mappa = useRef<MapLibre | null>(null);
  const puntiOra = useRef<Punti>(puntiDi([]));
  const inquadrata = useRef(false);
  const [disegnati, setDisegnati] = useState<number | null>(null);
  const [senzaFondo, setSenzaFondo] = useState(false);
  const [rotta, setRotta] = useState(false);

  const filtri = useMemo(() => pulisci(stato.filtri), [stato.filtri]);
  const risorsa = stato.risorsa;
  const dove = useRef(risorsa);
  dove.current = risorsa;
  const campi = useMemo(() => campiDi(risorsa), [risorsa]);
  const richiesta = useMemo(
    () => ({
      filtri: conAncheFiltro(filtri, { campo: campi.lat, op: "non_vuoto" }, { campo: campi.lng, op: "non_vuoto" }),
      ordine: [],
      colonne: [...new Set([campi.nome, campi.lat, campi.lng, ...(risorsa === "attivita" ? ["azienda_id"] : [])])],
    }),
    [filtri, campi, risorsa],
  );
  const q = useQuery({
    queryKey: [risorsa, "cerca", "mappa", richiesta],
    queryFn: ({ signal }) => leggiFinoA(risorsa, richiesta, MASSIMO, signal),
    retry: false,
  });
  const senzaPosizione: Gruppo = { o: [{ campo: campi.lat, op: "vuoto" }, { campo: campi.lng, op: "vuoto" }] };
  const senza = useCerca(risorsa, { filtri: conAncheFiltro(filtri, senzaPosizione), quanti: 0 });
  const punti = useMemo(
    () =>
      puntiDi(
        (q.data?.righe ?? []).map((r) => ({
          id: risorsa === "attivita" ? r.azienda_id : r.id,
          nome: r[campi.nome],
          lat: r[campi.lat],
          lng: r[campi.lng],
        })),
      ),
    [q.data, campi, risorsa],
  );

  useEffect(() => {
    if (!contenitore.current) return;
    let m: MapLibre;
    try {
      m = new MapLibre({ container: contenitore.current, style: fondoPieno(), center: [12.5, 42.5], zoom: 5, attributionControl: false });
    } catch {
      setRotta(true);
      return;
    }
    mappa.current = m;
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new AttributionControl({ compact: false, customAttribution: ATTRIBUZIONE }), "bottom-right");
    m.on("style.load", () => disegnaPunti(m, puntiOra.current));
    let ultimo = 0;
    m.on("render", () => {
      if (performance.now() - ultimo < 500) return;
      ultimo = performance.now();
      setDisegnati(puntiDisegnati(m));
    });
    m.on("idle", () => setDisegnati(puntiDisegnati(m)));
    m.on("error", () => undefined);

    fetch(STILE)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s) => m.setStyle(s, { diff: false }))
      .catch(() => setSenzaFondo(true));

    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    m.on("click", PUNTI, (e: MapLayerMouseEvent) => {
      const id = (e.features?.[0] as MapGeoJSONFeature | undefined)?.properties?.id;
      if (id) navigate(`/${dove.current === "attivita" ? "aziende" : dove.current}/${String(id)}`);
    });
    m.on("click", GRAPPOLI, (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      void (m.getSource(SORGENTE) as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id as number).then((zoom) => {
        m.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom });
      });
    });
    m.on("mouseenter", PUNTI, (e: MapLayerMouseEvent) => {
      m.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (f) popup.setLngLat((f.geometry as Point).coordinates as [number, number]).setText(String(f.properties.nome)).addTo(m);
    });
    m.on("mouseleave", PUNTI, () => {
      m.getCanvas().style.cursor = "";
      popup.remove();
    });
    m.on("mouseenter", GRAPPOLI, () => {
      m.getCanvas().style.cursor = "pointer";
    });
    m.on("mouseleave", GRAPPOLI, () => {
      m.getCanvas().style.cursor = "";
    });
    return () => {
      popup.remove();
      m.remove();
      mappa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    puntiOra.current = punti;
    const m = mappa.current;
    if (!m || !q.data) return;
    if (m.getSource(SORGENTE)) disegnaPunti(m, punti);
    if (!inquadrata.current && punti.features.length) {
      inquadrata.current = true;
      inquadra(m, punti);
    }
  }, [punti, q.data]);

  useEffect(() => {
    inquadrata.current = false;
  }, [filtri]);

  if (rotta) return <Errore messaggio="Questo browser non riesce a disegnare la mappa (serve WebGL). La tabella coi filtri funziona lo stesso." />;
  if (q.error) return <Errore messaggio={messaggioDi(q.error, "I punti non si sono caricati.")} onRiprova={() => void q.refetch()} />;
  return (
    <div className="mappa-crm relative mx-6 mb-4 min-h-0 flex-1 overflow-hidden rounded-lg border border-line" data-griglia="mappa" data-punti={q.data?.righe.length} data-punti-disegnati={disegnati ?? undefined} data-totale={q.data?.totale}>
      {}
      <div className="absolute inset-0">
        <div ref={contenitore} className="size-full" />
      </div>
      {q.isPending ? (
        <div className="absolute top-2 left-2 rounded-lg bg-background shadow-carta">
          <Puntini etichetta="Carico i punti" />
        </div>
      ) : null}
      <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5 text-xs">
        {senza.data?.totale ? (
          <button
            type="button"
            data-senza-posizione={senza.data.totale}
            className="rounded-[6px] border border-line bg-background px-2 py-1 text-ink2 shadow-carta hover:text-ink hover:underline"
            onClick={() => cambia({ modo: "tabella", filtri: conAncheFiltro(stato.filtri, senzaPosizione) })}
          >
            {numeri.format(senza.data.totale)} senza posizione
          </button>
        ) : null}
        {q.data && q.data.totale > q.data.righe.length ? (
          <span className="rounded-[6px] bg-warn-soft px-2 py-1 text-warn">Qui ci sono i primi {q.data.righe.length} punti su {q.data.totale}</span>
        ) : null}
        {senzaFondo ? <span className="rounded-[6px] bg-background px-2 py-1 text-mute shadow-carta">Lo sfondo della mappa non si è caricato: i punti restano giusti.</span> : null}
      </div>
    </div>
  );
}
