import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Chip, GruppoLegami } from "@/components/crm/forme";
import { chiedi } from "@/crm/chiama/api";
import { dataCortaOra } from "@/crm/tempo";
import { PannelloOrigine } from "./Pannello";
import { nomeVoce, SCRAPING_MAPS, type RigaOrigine } from "./voci";

const QUANTI = 50;

export const useArriviAzienda = (azienda?: string | null) =>
  useQuery({
    queryKey: ["origini", "azienda", azienda],
    enabled: !!azienda,
    queryFn: () => chiedi<RigaOrigine[]>(`/origini/elenco?azienda_id=${encodeURIComponent(azienda ?? "")}&_sort=quando&_order=ASC&_start=0&_end=${QUANTI}`),
  });

const daRaccolta = (o: RigaOrigine) => o.voce === "freddo" && !!o.parola;
const sopraDi = (o: RigaOrigine) => (daRaccolta(o) ? SCRAPING_MAPS : [nomeVoce(o.voce), o.da_chi].filter(Boolean).join(" · "));
const sottoDi = (o: RigaOrigine) => {
  if (daRaccolta(o)) return o.lista || [o.parola, o.zona || o.luogo].filter(Boolean).join(" · ");
  return o.voce === "freddo" ? o.zona || o.luogo : "";
};

const unaPerRicerca = (righe: RigaOrigine[]) => {
  const viste = new Set<string>();
  return righe.filter((o) => {
    if (!daRaccolta(o)) return true;
    const chiave = o.lista || o.parola;
    if (viste.has(chiave)) return false;
    viste.add(chiave);
    return true;
  });
};

const LinkMaps = ({ maps }: { maps?: string | null }) =>
  maps && /^https:\/\/www\.google\.[a-z.]+\/maps\//.test(maps) ? (
    <a
      data-link-maps
      href={maps}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline [&_svg]:size-3"
    >
      Apri su Google Maps
      <ExternalLink />
    </a>
  ) : null;

export const ProvenienzaLato = ({ azienda }: { azienda: string }) => {
  const { data } = useArriviAzienda(azienda);
  const [aperto, setAperto] = useState(false);
  const o = data?.find((x) => x.prima) ?? data?.[0];
  if (!o) return null;
  return (
    <GruppoLegami icona={<MapPin />} titolo="Provenienza" conteggio="">
      <div data-provenienza className="min-w-0 px-2 py-1">
        <button type="button" data-apri-arrivo onClick={() => setAperto(true)} className="block max-w-full truncate text-left text-ink hover:underline">
          {sopraDi(o)}
        </button>
        {sottoDi(o) ? <p className="truncate text-xs text-mute">{sottoDi(o)}</p> : null}
        <LinkMaps maps={o.maps} />
      </div>
      {aperto ? <PannelloOrigine id={o.id} onChiudi={() => setAperto(false)} /> : null}
    </GruppoLegami>
  );
};

export const DaDoveScheda = ({ azienda, senzaFreddo }: { azienda?: string | null; senzaFreddo?: boolean }) => {
  const { data } = useArriviAzienda(azienda);
  const [aperto, setAperto] = useState<string | null>(null);
  const righe = unaPerRicerca(data ?? []).filter((o) => !(senzaFreddo && daRaccolta(o)));
  if (!righe.length) return null;
  return (
    <section data-blocco="da-dove" className="mt-5 border-t border-line pt-3.5">
      <h3 className="mb-2 text-xs font-medium text-mute">Da dove</h3>
      <ul className="grid gap-2.5">
        {righe.map((o) => (
          <li key={o.id} data-arrivo={o.id} className="min-w-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {o.prima ? <Chip tono="blu">Origine</Chip> : <Chip>Ritorno</Chip>}
                <button type="button" data-apri-arrivo onClick={() => setAperto(o.id)} className="min-w-0 truncate text-left font-medium text-ink underline-offset-3 hover:underline">
                  {sopraDi(o)}
                </button>
                <span className="text-xs text-mute tabular-nums">{dataCortaOra(o.quando)}</span>
              </div>
              {sottoDi(o) ? <p className="truncate text-xs text-mute">{sottoDi(o)}</p> : null}
              <LinkMaps maps={o.maps} />
              {o.risposte_modulo?.length ? (
                <dl data-risposte className="mt-1.5 grid max-w-[62ch] gap-0.5 text-cella">
                  {o.risposte_modulo.map((r, i) => (
                    <div key={`${i}-${r.d}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                      <dt className="min-w-0 text-mute">{r.d}</dt>
                      <dd className="m-0 min-w-0 break-words text-ink">{r.r}</dd>
                    </div>
                  ))}
                </dl>
              ) : o.risposte ? (
                <p data-messaggio className="mt-1.5 max-w-[62ch] break-words whitespace-pre-line text-cella text-ink">
                  {o.risposte}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {aperto ? <PannelloOrigine id={aperto} onChiudi={() => setAperto(null)} /> : null}
    </section>
  );
};

export const notaCoperta = (nota: string | null | undefined, arrivi: RigaOrigine[] | undefined): boolean => {
  const righe = (nota ?? "").split("\n").map((r) => r.trim()).filter(Boolean);
  if (!righe.length || !arrivi?.length) return false;
  const note = new Set(arrivi.flatMap((a) => [...(a.risposte_modulo ?? []).map((r) => `${r.d}: ${r.r}`.trim()), ...(a.risposte ?? "").split("\n").map((r) => r.trim())]));
  return righe.every((r) => note.has(r));
};
