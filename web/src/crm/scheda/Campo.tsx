import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Editor, type Opzione, type TipoCampo } from "./Editor";
import { useModifica, type OpzioniModifica } from "./useModifica";

export interface CampoProps extends OpzioniModifica {
  nome: string;
  etichetta: string;
  icona?: ReactNode;
  tipo?: TipoCampo;
  opzioni?: Opzione[];
  mostra?: ReactNode;
  href?: string;
  intero?: boolean;
}

export const Campo = ({ nome, etichetta, icona, tipo, opzioni, mostra, href, intero, ...modifica }: CampoProps) => {
  const m = useModifica(modifica);
  const testo = mostra ?? (modifica.valore || <span className="text-assente">—</span>);
  return (
    <div
      className={cn("grid grid-cols-[150px_minmax(0,1fr)] items-start", intero && "md:col-span-2")}
      data-campo={nome}
    >
      <dt className="flex min-h-8 items-center gap-2 text-mute [&_svg]:size-3.5 [&_svg]:text-mute-deco">
        {icona}
        {etichetta}
      </dt>
      <dd className="m-0 flex min-h-8 min-w-0 items-center">
        {m.aperto ? (
          <Editor nome={nome} etichetta={etichetta} tipo={tipo} opzioni={opzioni} m={m} />
        ) : href && modifica.valore ? (
          <span className="group flex min-h-7 w-full min-w-0 items-center gap-1 rounded-md px-2 py-1 hover:bg-hover">
            <a
              href={href}
              className="truncate text-ink2 underline-offset-3 hover:underline"
              {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {testo}
            </a>
            <button
              type="button"
              onClick={m.apri}
              aria-label={`Modifica ${etichetta}`}
              className="ml-auto grid size-5 shrink-0 place-items-center rounded-sm text-mute-deco opacity-0 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Pencil className="size-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={m.apri}
            aria-label={modifica.valore ? `Modifica ${etichetta}: ${modifica.valore}` : `Modifica ${etichetta}`}
            className={cn(
              "min-h-7 w-full min-w-0 rounded-md px-2 py-1 text-left hover:bg-hover",
              tipo === "area" ? "whitespace-pre-wrap" : "truncate",
            )}
          >
            {testo}
          </button>
        )}
      </dd>
    </div>
  );
};

export const TitoloScheda = ({ nome, etichetta, ...modifica }: OpzioniModifica & { nome: string; etichetta: string }) => {
  const m = useModifica(modifica);
  if (m.aperto) return <Editor nome={nome} etichetta={etichetta} m={m} className="h-9 text-scheda font-semibold" />;
  return (
    <h1 className="text-scheda font-semibold tracking-[-0.015em] text-ink">
      <button
        type="button"
        onClick={m.apri}
        title={`Modifica ${etichetta}`}
        className="-mx-1 rounded-md px-1 text-left hover:bg-hover"
      >
        {modifica.valore}
      </button>
    </h1>
  );
};
