import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Building2, Target, User, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AvatarPersona, Chip, ChipSocio, LogoAzienda, type TonoChip } from "@/components/crm/forme";
import type { Socio } from "@/crm/soci";
import { Checkbox } from "@/components/ui/checkbox";
import { useFatto } from "@/crm/attivita/dati";
import { dataCorta, giornoDi, oraDi, spostaGiorno } from "@/crm/attivita/tempo";
import { DaDove, GiornoOra, Quando, SegniStato, StatoCella, UltimaAttivita, VersoScheda, Vuoto } from "@/crm/colonne/celle";
import type { Colonna } from "@/crm/colonne/useColonne";
import { DataOra } from "@/crm/DataOra";
import { hrefTelefono, pathAzienda, pathPersona } from "@/crm/persone/campi";
import { cn } from "@/lib/utils";
import { useModificaCompito, type Legame, type RigaCompito } from "./dati";
import { ScegliSocio } from "./ScegliSocio";

const FINE_GIORNO = "23:59";
const LEGAMI: Record<Legame, { nome: string; icona: LucideIcon }> = {
  trattativa: { nome: "Su trattativa", icona: Target },
  persona: { nome: "Su persona", icona: User },
  azienda: { nome: "Solo azienda", icona: Building2 },
};

const Manca = ({ testo, id }: { testo: string; id: string }) => (
  <span data-manca={id} className="text-xs text-mute">
    {testo}
  </span>
);

const Telefono = ({ v }: { v?: string | null }) => {
  const href = v ? hrefTelefono(v) : undefined;
  return href ? (
    <a href={href} data-tel className="block truncate text-xs leading-[15px] text-acc-ink hover:underline">
      {v}
    </a>
  ) : null;
};

const scadenza = (quando: string, giorno: string, fatto: boolean) => {
  const delGiorno = giornoDi(quando);
  const tardi = !fatto && Date.parse(quando) < Date.now();
  const ora = oraDi(quando);
  const conOra = ora === FINE_GIORNO ? "" : ` alle ${ora}`;
  if (delGiorno === giorno) {
    if (tardi) return { tardi, testo: `scaduto alle ${ora}` };
    return { tardi, testo: `oggi${conOra}` };
  }
  if (delGiorno === spostaGiorno(giorno, 1)) return { tardi, testo: `domani${conOra}` };
  const anno = delGiorno.slice(0, 4) === giorno.slice(0, 4) ? "" : `/${delGiorno.slice(2, 4)}`;
  return { tardi, testo: `${tardi ? "scaduto " : ""}${dataCorta(quando)}${anno}${conOra}` };
};

const CellaCompito = ({ r, riapri }: { r: RigaCompito; riapri: (a: RigaCompito, fatto: boolean) => Promise<boolean> }) => {
  const { segna, salvando } = useFatto();
  const modifica = useModificaCompito();
  const [segnata, setSegnata] = useState(false);
  const [testo, setTesto] = useState<string | null>(null);
  const [visto, setVisto] = useState<string | null>(null);
  const uscito = useRef(false);
  const fatto = Boolean(r.fatto_il);

  useEffect(() => setVisto(null), [r.testo]);

  const chiudi = async () => {
    setSegnata(true);
    if (await segna(r, true)) toast.success("Compito fatto", { action: { label: "Annulla", onClick: () => void riapri(r, false) } });
    else setSegnata(false);
  };
  const salva = async () => {
    if (uscito.current || testo === null) return;
    uscito.current = true;
    const nuovo = testo.trim();
    setTesto(null);
    if (!nuovo || nuovo === r.testo) return;
    setVisto(nuovo);
    if (!(await modifica(r.id, { testo: nuovo }))) setVisto(null);
  };
  const tasti = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void salva();
    } else if (e.key === "Escape") {
      e.preventDefault();
      uscito.current = true;
      setTesto(null);
    }
  };
  const mostrato = visto ?? r.testo;
  const { nome, icona: Icona } = LEGAMI[r.legame];
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Checkbox
        checked={fatto ? !salvando : salvando || segnata}
        disabled={salvando}
        onCheckedChange={() => void (fatto ? segna(r, false) : chiudi())}
        aria-label={fatto ? `Riapri il compito: ${r.testo}` : `Segna fatto: ${r.testo || "compito senza testo"}`}
      />
      {testo !== null ? (
        <input
          autoFocus
          aria-label="Testo del compito"
          data-modifica-testo
          value={testo}
          maxLength={2000}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={tasti}
          onBlur={() => void salva()}
          className="h-[26px] min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-cella text-ink outline-none focus-visible:border-acc focus-visible:ring-3 focus-visible:ring-acc-soft"
        />
      ) : (
        <div className="min-w-0 flex-1 leading-[15px]">
          <button
            type="button"
            title={mostrato}
            data-testo-compito
            onClick={() => {
              uscito.current = false;
              setTesto(mostrato);
            }}
            className={cn(
              "block w-full cursor-text truncate rounded-sm text-left outline-none hover:underline hover:decoration-line-strong focus-visible:ring-2 focus-visible:ring-ring/50",
              mostrato ? "text-ink" : "text-mute",
              fatto && "text-mute line-through",
            )}
          >
            {mostrato || "Compito senza testo"}
          </button>
          <span data-legame={r.legame} className="flex items-center gap-1 text-xs leading-[15px] text-mute [&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:text-mute-deco">
            <Icona aria-hidden="true" />
            {nome}
          </span>
        </div>
      )}
    </div>
  );
};

const CellaScadenza = ({ r, giorno }: { r: RigaCompito; giorno: string }) => {
  const modifica = useModificaCompito();
  const [aperta, setAperta] = useState(false);
  const [vista, setVista] = useState<string | null | undefined>(undefined);
  useEffect(() => setVista(undefined), [r.scadenza]);
  const valore = vista === undefined ? r.scadenza : vista;
  if (aperta) {
    return (
      <DataOra
        apertoSubito
        etichetta="Scadenza"
        oraVuota={FINE_GIORNO}
        valore={valore}
        vuoto="Scegli"
        className="h-[26px]"
        onChiudi={() => setAperta(false)}
        onCambia={(v) => {
          setAperta(false);
          setVista(v);
          void modifica(r.id, { scadenza: v }).then((ok) => {
            if (!ok) setVista(undefined);
          });
        }}
      />
    );
  }
  const s = valore ? scadenza(valore, giorno, Boolean(r.fatto_il)) : null;
  return (
    <button
      type="button"
      data-scadenza
      aria-label={s ? `Cambia la scadenza: ${s.testo}` : "Metti una scadenza"}
      onClick={() => setAperta(true)}
      className={cn(
        "rounded-sm tabular-nums outline-none hover:underline hover:decoration-line-strong focus-visible:ring-2 focus-visible:ring-ring/50",
        s?.tardi ? "font-medium text-danger" : s ? "text-ink2" : "text-xs text-mute",
      )}
    >
      {s?.testo ?? "Metti una data"}
    </button>
  );
};

const Azienda = ({ r }: { r: RigaCompito }) =>
  r.azienda_id ? (
    <span className="flex min-w-0 items-center gap-2">
      <LogoAzienda nome={r.azienda_nome ?? ""} />
      <span className="min-w-0 leading-[15px]">
        <span className="block truncate">
          <VersoScheda to={pathAzienda(r.azienda_id)}>{r.azienda_nome}</VersoScheda>
        </span>
        <Telefono v={r.azienda_telefono} />
      </span>
    </span>
  ) : (
    <Manca id="azienda" testo="Nessuna azienda" />
  );

const Persona = ({ r }: { r: RigaCompito }) =>
  r.persona_id ? (
    <span className="flex min-w-0 items-center gap-2">
      <AvatarPersona nome={r.persona_nome ?? ""} />
      <span className="min-w-0 leading-[15px]">
        <span className="block truncate">
          <VersoScheda to={pathPersona(r.persona_id)}>{r.persona_nome}</VersoScheda>
        </span>
        <Telefono v={r.persona_telefono} />
      </span>
    </span>
  ) : (
    <Manca id="persona" testo="Nessuna persona" />
  );

const Trattativa = ({ r, toni }: { r: RigaCompito; toni: Map<string, TonoChip> }) =>
  r.trattativa_id ? (
    <>
      <VersoScheda to={`/trattative/${r.trattativa_id}`}>
        <span data-fase={r.fase_id ?? ""} title={r.percorso_nome ?? undefined} className="inline-flex hover:opacity-80">
          <Chip tono={toni.get(r.fase_id ?? "") ?? toni.get(r.fase_nome ?? "") ?? "neutro"}>{r.fase_nome ?? r.fase_id}</Chip>
        </span>
      </VersoScheda>
      <SegniStato archiviata={Boolean(r.trattativa_archiviata)} />
    </>
  ) : (
    <Manca id="trattativa" testo="Nessuna trattativa" />
  );

const Prossimo = ({ r }: { r: RigaCompito }) => {
  if (!r.trattativa_id || (!r.prossimo_passo && !r.prossimo_il)) return <Vuoto />;
  return (
    <span className="block min-w-0 leading-[15px]" title={r.prossimo_passo ?? undefined}>
      <span className="block truncate text-ink2">{r.prossimo_passo || "Senza passo"}</span>
      {r.prossimo_il ? (
        <span className="block truncate text-xs">
          <GiornoOra v={r.prossimo_il} />
        </span>
      ) : null}
    </span>
  );
};

const Assegnato = ({ r, soci, nomeDi }: { r: RigaCompito; soci: Socio[]; nomeDi: (email?: string | null) => string }) => {
  const modifica = useModificaCompito();
  const [visto, setVisto] = useState<string | null>(null);
  useEffect(() => setVisto(null), [r.assegnato]);
  const valore = visto ?? r.assegnato;
  return (
    <span data-chi>
      <ScegliSocio
        valore={valore?.toLowerCase() ?? null}
        nome={nomeDi(valore)}
        soci={soci}
        etichetta="Assegnato a"
        onScegli={(email) => {
          setVisto(email);
          void modifica(r.id, { assegnato_a: email }).then((ok) => {
            if (!ok) setVisto(null);
          });
        }}
      />
    </span>
  );
};

export const colonneCompiti = ({
  nomeDi,
  soci,
  giorno,
  toni,
  riapri,
}: {
  nomeDi: (email?: string | null) => string;
  soci: Socio[];
  giorno: string;
  toni: Map<string, TonoChip>;
  riapri: (a: RigaCompito, fatto: boolean) => Promise<boolean>;
}): Colonna<RigaCompito>[] => [
  { id: "testo", etichetta: "Compito", largo: "w-[260px] max-w-[260px] sm:w-[290px] sm:max-w-[290px]", cella: (r) => <CellaCompito r={r} riapri={riapri} /> },
  { id: "scadenza", etichetta: "Scadenza", cella: (r) => <CellaScadenza r={r} giorno={giorno} /> },
  { id: "assegnato", etichetta: "Assegnato a", cella: (r) => <Assegnato r={r} soci={soci} nomeDi={nomeDi} /> },
  { id: "azienda", etichetta: "Azienda", largo: "max-w-[240px]", cella: (r) => <Azienda r={r} /> },
  { id: "persona", etichetta: "Persona", largo: "max-w-[220px]", cella: (r) => <Persona r={r} /> },
  { id: "trattativa", etichetta: "Trattativa", largo: "max-w-[240px]", cella: (r) => <Trattativa r={r} toni={toni} /> },
  { id: "trattativa_prossimo", etichetta: "Prossimo", largo: "max-w-[240px]", cella: (r) => <Prossimo r={r} /> },
  { id: "creato_da", etichetta: "Creato da", cella: (r) => (r.creato_da ? <ChipSocio nome={nomeDi(r.creato_da)} /> : <Vuoto />) },
  { id: "quando", etichetta: "Creato il", cella: (r) => <Quando v={r.quando} /> },
  { id: "azienda_da_dove", etichetta: "Da dove", largo: "max-w-[240px]", nascosta: true, cella: (r) => <DaDove d={r.da_dove} /> },
  { id: "azienda_stato", etichetta: "Stato azienda", nascosta: true, cella: (r) => <StatoCella stato={r.stato} /> },
  { id: "legame", etichetta: "Tipo", nascosta: true, cella: (r) => <span className="text-ink2">{LEGAMI[r.legame].nome}</span> },
  { id: "azienda_ultima", etichetta: "Ultima attività", largo: "max-w-[280px]", nascosta: true, cella: (r) => <UltimaAttivita u={r.ultima} nomeDi={nomeDi} /> },
  { id: "fatto_il", etichetta: "Fatto il", nascosta: true, cella: (r) => <Quando v={r.fatto_il} /> },
];

export const EXTRA_DI: Record<string, string> = { azienda_stato: "stato", azienda_da_dove: "da_dove", azienda_ultima: "ultima" };
