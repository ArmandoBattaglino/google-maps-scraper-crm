import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataOra } from "@/crm/DataOra";
import { istanteRoma } from "@/crm/tempo";
import { ESITI_CHIAMATA, suAzienda, type Attivita, type Legami } from "./campi";
import { domani } from "./tempo";

export const Chiamata = ({
  legami,
  bloccato,
  onEsito,
}: {
  legami: Legami;
  bloccato: boolean;
  onEsito: (dati: Partial<Attivita>) => void;
}) => {
  const [minuti, setMinuti] = useState("");
  const [richiama, setRichiama] = useState<string | null>(() => istanteRoma(domani()));
  const azienda = suAzienda(legami);
  const esiti = ESITI_CHIAMATA.filter((e) => e.su === "sempre" || e.su === (azienda ? "azienda" : "altro"));
  return (
    <div className="space-y-2">
      <div role="group" aria-label="Esito della chiamata" className="flex flex-wrap gap-1.5">
        {esiti.map((e) => (
          <Button
            key={e.nome}
            variant="outline"
            size="sm"
            disabled={bloccato}
            onClick={() =>
              onEsito({
                tipo: "chiamata",
                esito: e.esito,
                ...(azienda && e.esito_azienda ? { esito_azienda: e.esito_azienda } : {}),
                ...(e.esito === "richiamare" && richiama ? { scadenza: richiama } : {}),
                ...(minuti ? { durata: Math.round(Number(minuti) * 60) } : {}),
              })
            }
          >
            {e.nome}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-ink2">
        <label className="flex items-center gap-1.5">
          Minuti
          <Input type="number" min={0} value={minuti} onChange={(e) => setMinuti(e.target.value)} className="h-7 w-16" />
        </label>
        <div className="flex items-center gap-1.5">
          <span>Richiama il</span>
          <DataOra etichetta="Richiama il" valore={richiama} onCambia={setRichiama} className="h-7 w-[190px]" />
        </div>
      </div>
    </div>
  );
};
