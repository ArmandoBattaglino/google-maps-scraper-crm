import { Fragment } from "react";
import { X } from "lucide-react";
import { useContesto } from "../contesto";
import type { Gruppo } from "../stato";
import { eGruppo, figli, legame, sostituisci } from "./albero";
import { partiCondizione, testoNodo } from "./leggibile";

const Pillola = ({ testo, onApri, onTogli, nome }: { testo: React.ReactNode; onApri: () => void; onTogli: () => void; nome: string }) => (
  <span data-pillola className="inline-flex h-[26px] max-w-[340px] items-center gap-1.5 rounded-full bg-acc-soft pr-1.5 pl-2.5 text-acc-ink">
    <button type="button" onClick={onApri} className="min-w-0 truncate outline-none focus-visible:underline">
      {testo}
    </button>
    <button
      type="button"
      onClick={onTogli}
      aria-label={`Togli il filtro ${nome}`}
      className="grid size-[18px] shrink-0 place-items-center rounded-full hover:bg-acc-soft-hover"
    >
      <X className="size-3.5" />
    </button>
  </span>
);

export const Pillole = ({ filtri, onCambia, onApri }: { filtri: Gruppo; onCambia: (f: Gruppo) => void; onApri: () => void }) => {
  const ctx = useContesto();
  return (
    <>
      {figli(filtri).map((n, i) => {
        const togli = () => onCambia(sostituisci(filtri, [i], null));
        const parola = i > 0 && legame(filtri) === "o" ? <span className="text-mute">o</span> : null;
        if (eGruppo(n)) {
          const t = testoNodo(ctx, n);
          return (
            <Fragment key={i}>
              {parola}
              <Pillola testo={t} nome={t} onApri={onApri} onTogli={togli} />
            </Fragment>
          );
        }
        const p = partiCondizione(ctx, n);
        return (
          <Fragment key={i}>
            {parola}
            <Pillola
              nome={p.campo}
              onApri={onApri}
              onTogli={togli}
              testo={
                <>
                  {p.campo} <em className="not-italic opacity-60">{p.op}</em> {p.valore}
                </>
              }
            />
          </Fragment>
        );
      })}
    </>
  );
};
