import { useState } from "react";
import { useCreate, useDelete, useNotify } from "ra-core";
import { Plus, Tags, X } from "lucide-react";
import { Chip } from "@/components/crm/forme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { coloreDaSalvare, tonoDi, type ColoreTag } from "./colori";
import { erroreDi, useTagSu, useTuttiITag, type OggettoTag, type Tag, type TagSu } from "./dati";
import { ElencoTag } from "./ElencoTag";

const useGesti = (oggetto: OggettoTag, oggettoId: string, messi: TagSu[]) => {
  const notifica = useNotify();
  const [crea] = useCreate(undefined, undefined, { returnPromise: true });
  const [cancella] = useDelete(undefined, undefined, { mutationMode: "pessimistic", returnPromise: true });

  const metti = (tagId: string) => crea("tag_su", { data: { tag_id: tagId, oggetto, oggetto_id: oggettoId } });

  const togli = async (riga: TagSu) => {
    try {
      await cancella("tag_su", { id: riga.id, previousData: riga });
    } catch (e) {
      notifica(`Il tag non è stato tolto: ${erroreDi(e)}`, { type: "error" });
    }
  };

  const scambia = async (tag: Tag) => {
    const gia = messi.find((m) => m.tag_id === tag.id);
    if (gia) return togli(gia);
    try {
      await metti(tag.id);
    } catch (e) {
      notifica(`Il tag non è stato messo: ${erroreDi(e)}`, { type: "error" });
    }
  };

  const creaEMetti = async (nome: string, colore: ColoreTag) => {
    try {
      const valore = coloreDaSalvare(colore);
      const nuovo = await crea("tag", { data: { nome, ...(valore ? { colore: valore } : {}) } });
      await metti(String(nuovo.id));
      return true;
    } catch (e) {
      notifica(`Il tag non è stato creato: ${erroreDi(e)}`, { type: "error" });
      return false;
    }
  };

  return { togli, scambia, creaEMetti };
};

export const TagOggetto = ({
  oggetto,
  oggettoId,
  className,
}: {
  oggetto: OggettoTag;
  oggettoId: string;
  className?: string;
}) => {
  const tag = useTuttiITag();
  const su = useTagSu(oggetto, oggettoId);
  const messi = su.data ?? [];
  const tutti = tag.data ?? [];
  const { togli, scambia, creaEMetti } = useGesti(oggetto, oggettoId, messi);
  const [aperto, setAperto] = useState(false);

  if (tag.isPending || su.isPending) {
    return (
      <span aria-label="Carico i tag" className="animate-pulse text-mute">
        ...
      </span>
    );
  }
  if (tag.error || su.error) {
    return (
      <span className="text-xs text-danger">
        Tag non letti.{" "}
        <button type="button" className="underline" onClick={() => void Promise.all([tag.refetch(), su.refetch()])}>
          Riprova
        </button>
      </span>
    );
  }

  const righe = messi
    .map((riga) => {
      const t = tutti.find((x) => x.id === riga.tag_id);
      return { riga, t, nome: t?.nome ?? "..." };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));

  return (
    <div
      data-tag-di={oggetto}
      onClick={(e) => e.stopPropagation()}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {righe.map(({ riga, t, nome }) => {
        return (
          <span key={riga.id} data-tag={nome} className="max-w-full">
            <Chip tono={tonoDi(t?.colore)}>
              <span className="truncate">{nome}</span>
              <button
                type="button"
                aria-label={`Togli il tag ${nome}`}
                onClick={() => void togli(riga)}
                className="-mr-1 ml-1 grid size-4 shrink-0 place-items-center rounded-sm opacity-60 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </Chip>
          </span>
        );
      })}
      <Popover open={aperto} onOpenChange={setAperto}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Aggiungi un tag"
              className="inline-flex h-[22px] items-center gap-1 rounded-sm px-1.5 text-xs text-mute hover:bg-hover hover:text-ink2"
            />
          }
        >
          <Plus className="size-3.5" />
          {messi.length ? null : "Tag"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[260px] gap-0 p-0 shadow-pop">
          <div onClick={(e) => e.stopPropagation()}>
            <ElencoTag
              tutti={tutti}
              scelti={new Set(messi.map((m) => m.tag_id))}
              onScegli={(t) => void scambia(t)}
              onCrea={creaEMetti}
              vuoto="Scrivi il nome del primo tag."
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const MenuTagCella = ({ oggetto, oggettoId, testo, className, onChiudi }: { oggetto: OggettoTag; oggettoId: string; testo: string; className?: string; onChiudi: () => void }) => {
  const tag = useTuttiITag();
  const su = useTagSu(oggetto, oggettoId);
  const messi = su.data ?? [];
  const { scambia, creaEMetti } = useGesti(oggetto, oggettoId, messi);
  return (
    <Popover open onOpenChange={(a) => !a && onChiudi()}>
      <PopoverTrigger className={className}>{testo || " "}</PopoverTrigger>
      <PopoverContent align="start" data-editore-cella className="w-[260px] gap-0 p-0 shadow-pop">
        {tag.isPending || su.isPending ? (
          <p aria-label="Carico i tag" className="animate-pulse px-3 py-2 text-mute">
            ...
          </p>
        ) : (
          <ElencoTag tutti={tag.data ?? []} scelti={new Set(messi.map((m) => m.tag_id))} onScegli={(t) => void scambia(t)} onCrea={creaEMetti} vuoto="Scrivi il nome del primo tag." />
        )}
      </PopoverContent>
    </Popover>
  );
};

export const SezioneTag = ({ oggetto, oggettoId }: { oggetto: OggettoTag; oggettoId: string }) => {
  const su = useTagSu(oggetto, oggettoId);
  return (
    <section className="mb-[22px]">
      <h3 className="mb-1.5 flex items-center gap-2 text-xs font-medium text-mute [&_svg]:size-3.5">
        <Tags />
        Tag
        <span className="ml-auto tabular-nums">{su.total ?? ""}</span>
      </h3>
      <TagOggetto oggetto={oggetto} oggettoId={oggettoId} />
    </section>
  );
};
