import { useState, type KeyboardEvent } from "react";
import { Mail, MessageCircle, Phone, SquareCheck, StickyNote, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DataOra } from "@/crm/DataOra";
import { BottoneWhatsapp } from "@/crm/whatsapp";
import { cn } from "@/lib/utils";
import type { Attivita, Legami, Soggetto } from "./campi";
import { Chiamata } from "./Chiamata";
import { useRegistra } from "./dati";
import { domani, romaAIso } from "./tempo";

type Modo = "nota" | "compito" | "chiamata" | "email" | "whatsapp";

const MODI: Record<Modo, { icona: LucideIcon; pulsante: string; segnaposto: string; salva?: string; serveTesto?: boolean }> = {
  nota: { icona: StickyNote, pulsante: "", segnaposto: "Scrivi una nota, o / per un compito", salva: "Salva nota", serveTesto: true },
  compito: { icona: SquareCheck, pulsante: "Compito", segnaposto: "Cosa c'è da fare", salva: "Crea compito", serveTesto: true },
  chiamata: { icona: Phone, pulsante: "Registra chiamata", segnaposto: "Com'è andata (facoltativo)" },
  email: { icona: Mail, pulsante: "Email", segnaposto: "Cosa hai scritto nell'email (facoltativo)", salva: "Registra email" },
  whatsapp: { icona: MessageCircle, pulsante: "WhatsApp", segnaposto: "Cosa hai scritto su WhatsApp (facoltativo)", salva: "Registra messaggio" },
};
const PULSANTI: Modo[] = ["compito", "chiamata", "email", "whatsapp"];
const FINE_GIORNO = "23:59";
const fineDiDomani = () => romaAIso(`${domani()}T23:59:59`);

export const Scrivi = ({ soggetto, legami, pronti }: { soggetto: Soggetto; legami: Legami; pronti: boolean }) => {
  const { registra, salvando } = useRegistra();
  const [modo, setModo] = useState<Modo>("nota");
  const [testo, setTesto] = useState("");
  const [scadenza, setScadenza] = useState<string | null>(fineDiDomani);

  const m = MODI[modo];
  const Icona = m.icona;
  const aperto = modo !== "nota" || testo.trim() !== "";
  const bloccato = salvando || !pronti;
  const azzera = () => {
    setModo("nota");
    setTesto("");
    setScadenza(fineDiDomani());
  };
  const salva = async (dati: Partial<Attivita>) => {
    if (await registra({ ...legami, testo: testo.trim(), ...dati })) azzera();
  };
  const invia = () => {
    if (bloccato || !m.salva || (m.serveTesto && !testo.trim())) return;
    if (modo === "compito") void salva({ tipo: "compito", scadenza });
    else if (modo === "nota") void salva({ tipo: "nota" });
    else if (modo !== "chiamata") void salva({ tipo: modo, esito: "inviato" });
  };
  const tasti = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") azzera();
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      invia();
    }
  };
  const scrivi = (v: string) => {
    if (modo === "nota" && v.startsWith("/")) {
      setModo("compito");
      setTesto(v.slice(1));
    } else setTesto(v);
  };

  return (
    <div data-scrivi={modo} className="mb-[18px] rounded-lg border border-line px-3 py-2 focus-within:border-acc">
      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1">
        <Icona aria-hidden="true" className="mt-[7px] size-3.5 shrink-0 text-mute-deco" />
        <Textarea
          value={testo}
          onChange={(e) => scrivi(e.target.value)}
          onKeyDown={tasti}
          placeholder={m.segnaposto}
          aria-label={m.segnaposto}
          rows={1}
          className={cn(
            "min-h-7 min-w-[220px] flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1 focus-visible:ring-0",
            aperto && "min-h-14",
          )}
        />
        <div role="group" aria-label="Cosa registrare" className="ml-auto flex flex-wrap gap-0.5">
          {PULSANTI.map((p) => {
            const PIcona = MODI[p].icona;
            return (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                aria-pressed={modo === p}
                data-modo={p}
                className={cn(modo === p && "bg-hover text-ink")}
                onClick={() => setModo(modo === p ? "nota" : p)}
              >
                <PIcona className="size-3.5" />
                {MODI[p].pulsante}
              </Button>
            );
          })}
        </div>
      </div>
      {aperto ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 border-t border-line2 pt-2">
          {modo === "chiamata" ? (
            <div className="min-w-0 flex-1">
              <Chiamata legami={legami} bloccato={bloccato} onEsito={(dati) => void salva(dati)} />
            </div>
          ) : (
            <>
              {modo === "compito" ? (
                <div className="flex items-center gap-1.5 text-ink2">
                  <span>Scadenza</span>
                  <DataOra etichetta="Scadenza" oraVuota={FINE_GIORNO} valore={scadenza} onCambia={setScadenza} className="h-7 w-[190px]" />
                </div>
              ) : null}
              {modo === "whatsapp" ? <BottoneWhatsapp {...soggetto} etichetta="Apri WhatsApp" size="sm" motivoVisibile /> : null}
              <span className="ml-auto text-xs text-mute">Ctrl + Invio per salvare, Esc per annullare</span>
              <Button size="sm" disabled={bloccato || (m.serveTesto && !testo.trim())} onClick={invia}>
                {m.salva}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
