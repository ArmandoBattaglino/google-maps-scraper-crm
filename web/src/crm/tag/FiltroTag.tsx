import { useEffect, useRef, useState } from "react";
import { useCreate, useGetList, useInput, useListContext, useNotify } from "ra-core";
import { Tags } from "lucide-react";
import { PillolaFiltro } from "@/components/crm/forme";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { coloreDaSalvare, type ColoreTag } from "./colori";
import { erroreDi, useTuttiITag, type OggettoTag } from "./dati";
import { ElencoTag } from "./ElencoTag";

export const useTagCambiato = (valore: string | null, oggetto: OggettoTag, rileggi: () => unknown) => {
  const { total } = useGetList(
    "tag_su",
    {
      filter: { tag_id: valore, oggetto },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: !!valore },
  );
  const prima = useRef(total);
  const daRileggere = useRef(rileggi);
  daRileggere.current = rileggi;
  useEffect(() => {
    if (prima.current !== undefined && total !== undefined && total !== prima.current) void daRileggere.current();
    prima.current = total;
  }, [total]);
};

export const SceltaFiltroTag = ({
  valore,
  onCambia,
}: {
  valore?: string | null;
  onCambia: (id: string | null) => void;
}) => {
  const { data: tutti = [], isPending, error } = useTuttiITag();
  const [aperto, setAperto] = useState(false);
  const [salva] = useCreate(undefined, undefined, { returnPromise: true });
  const notifica = useNotify();

  const crea = async (nome: string, colore: ColoreTag) => {
    try {
      const tinta = coloreDaSalvare(colore);
      await salva("tag", { data: { nome, ...(tinta ? { colore: tinta } : {}) } });
      return true;
    } catch (e) {
      notifica(`Il tag non è stato creato: ${erroreDi(e)}`, { type: "error" });
      return false;
    }
  };

  if (valore) {
    const nome = tutti.find((t) => t.id === valore)?.nome ?? (isPending ? "..." : "tag tolto");
    return <PillolaFiltro campo="Tag" valore={nome} onTogli={() => onCambia(null)} />;
  }
  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger render={<Button type="button" variant="outline" aria-label="Filtra per tag" />}>
        <Tags className="size-3.5 text-mute-deco" />
        Tag
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] gap-0 p-0 shadow-pop">
        {error ? (
          <p className="p-3 text-danger">Tag non letti: riapri il menu per riprovare.</p>
        ) : (
          <ElencoTag
            tutti={tutti}
            onScegli={(t) => {
              setAperto(false);
              onCambia(t.id);
            }}
            onCrea={crea}
            vuoto={isPending ? "..." : "Non c'è ancora nessun tag: scrivine il nome per crearlo."}
          />
        )}
      </PopoverContent>
    </Popover>
  );
};

export const FiltroTag = ({ source = "tag", oggetto }: { source?: string; oggetto: OggettoTag; alwaysOn?: boolean }) => {
  const { field } = useInput({ source });
  const { refetch } = useListContext();
  const valore = (field.value as string | null | undefined) || null;
  useTagCambiato(valore, oggetto, refetch);

  return (
    <div className="mt-auto flex min-h-[30px] items-center">
      <SceltaFiltroTag valore={valore} onCambia={(id) => field.onChange(id ?? "")} />
    </div>
  );
};
