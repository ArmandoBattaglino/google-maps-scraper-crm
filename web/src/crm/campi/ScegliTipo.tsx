import { cn } from "@/lib/utils";
import { TIPI, tipoDi, type Tipo } from "./tipi";

export const ScegliTipo = ({ valore, onCambia }: { valore: Tipo; onCambia: (t: Tipo) => void }) => (
  <fieldset className="mt-4">
    <legend className="text-xs font-medium text-mute">Tipo</legend>
    <div className="mt-1 grid grid-cols-2 gap-1">
      {TIPI.map((t) => {
        const Icona = t.icona;
        const scelto = valore === t.id;
        return (
          <label
            key={t.id}
            className={cn(
              "relative flex h-[30px] cursor-pointer items-center gap-1.5 rounded-md border px-2 text-cella has-focus-visible:ring-3 has-focus-visible:ring-acc-soft",
              scelto ? "border-acc bg-acc-soft text-acc-ink" : "border-line bg-background text-ink2 hover:bg-hover",
            )}
          >
            <input
              type="radio"
              name="tipo"
              className="absolute inset-0 cursor-pointer opacity-0"
              checked={scelto}
              onChange={() => onCambia(t.id)}
            />
            <Icona className={cn("size-3.5 shrink-0", !scelto && "text-mute-deco")} />
            <span className="truncate">{t.nome}</span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

export const TipoFisso = ({ tipo }: { tipo: Tipo }) => {
  const { icona: Icona, nome } = tipoDi(tipo);
  return (
    <div className="mt-4" data-tipo-fisso>
      <p className="text-xs font-medium text-mute">Tipo</p>
      <p className="mt-1 flex items-center gap-1.5 text-ink">
        <Icona className="size-3.5 text-mute-deco" />
        {nome}
      </p>
      <p className="mt-1 text-cella text-mute">
        Il tipo resta questo, le righe hanno già valori scritti così. Per un altro tipo, archivia il campo e creane uno nuovo.
      </p>
    </div>
  );
};
