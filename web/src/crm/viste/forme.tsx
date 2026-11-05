import { Button } from "@/components/ui/button";

export const Puntini = ({ etichetta }: { etichetta: string }) => (
  <p className="animate-pulse px-6 py-4 text-titolo tracking-[0.2em] text-mute" role="status" aria-label={etichetta}>
    ...
  </p>
);

export const Errore = ({ messaggio, onRiprova, azione = "Riprova" }: { messaggio: string; onRiprova?: () => void; azione?: string }) => (
  <div role="alert" className="mx-6 flex items-center gap-3 rounded-lg border border-line p-4 text-ink2">
    {messaggio}
    {onRiprova ? (
      <Button variant="outline" onClick={onRiprova}>
        {azione}
      </Button>
    ) : null}
  </div>
);

export const Vuoto = ({ conFiltri, onTogli }: { conFiltri: boolean; onTogli: () => void }) => (
  <div data-vuoto className="mx-6 mt-2 flex max-w-[560px] items-center gap-3 rounded-lg border border-dashed border-line p-5 text-ink2">
    {conFiltri ? "Nessuna riga con questi filtri." : "Qui non c'è ancora nessuna riga."}
    {conFiltri ? (
      <Button variant="outline" onClick={onTogli}>
        Togli i filtri
      </Button>
    ) : null}
  </div>
);
