import { useState, type FormEvent } from "react";
import { useGetIdentity, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScriviVista } from "../dati";
import type { StatoPagina } from "../useStatoVista";
import { messaggioDi } from "./forme";

export const Salva = ({ pagina }: { pagina: StatoPagina }) => {
  const { stato, vista, modificata, annulla, apri } = pagina;
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const { crea, salva } = useScriviVista();
  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState("");
  const [del, setDel] = useState<"mia" | "team">("mia");
  const [inCorso, setInCorso] = useState(false);

  const salvaModifiche = async () => {
    if (!vista) return;
    setInCorso(true);
    try {
      await salva(vista.id, stato);
      annulla();
      notify("Modifiche salvate", { type: "success" });
    } catch (e) {
      notify(messaggioDi(e, "Le modifiche non si sono salvate"), { type: "error" });
    } finally {
      setInCorso(false);
    }
  };

  const salvaNuova = async (e: FormEvent) => {
    e.preventDefault();
    const pulito = nome.trim();
    if (!pulito) return;
    setInCorso(true);
    try {
      const di = del === "team" ? "team" : String(identity?.id ?? "").toLowerCase();
      const nuova = await crea(pulito, di, stato);
      setAperto(false);
      setNome("");
      apri({ vista: nuova.id });
      notify(del === "team" ? "Vista salvata per il team" : "Vista salvata", { type: "success" });
    } catch (err) {
      notify(messaggioDi(err, "La vista non si è salvata"), { type: "error" });
    } finally {
      setInCorso(false);
    }
  };

  return (
    <>
      <span aria-hidden="true" className="h-[30px] w-0" />
      {modificata ? (
        <Button variant="ghost" onClick={annulla}>
          Annulla modifiche
        </Button>
      ) : null}
      {modificata && vista ? (
        <Button variant="outline" disabled={inCorso} onClick={() => void salvaModifiche()}>
          Salva modifiche
        </Button>
      ) : null}
      {modificata || !vista ? (
        <Popover open={aperto} onOpenChange={setAperto}>
          <PopoverTrigger render={<Button variant={vista ? "ghost" : "outline"} />}>Salva come vista</PopoverTrigger>
          <PopoverContent align="end" className="w-[280px] gap-3 p-3 shadow-pop">
            <form onSubmit={(e) => void salvaNuova(e)} className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="nome-vista" className="text-xs text-mute">
                  Nome
                </Label>
                <Input id="nome-vista" autoFocus maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Da richiamare a Genova" />
              </div>
              <fieldset className="grid gap-1">
                <legend className="mb-1 text-xs text-mute">Di chi è</legend>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="di-vista" className="accent-acc" checked={del === "mia"} onChange={() => setDel("mia")} />
                  Mia
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="di-vista" className="accent-acc" checked={del === "team"} onChange={() => setDel("team")} />
                  Del team
                </label>
              </fieldset>
              <Button type="submit" disabled={inCorso || !nome.trim()}>
                Salva la vista
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );
};
