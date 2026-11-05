import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Soggetto } from "@/crm/attivita/campi";
import { cn } from "@/lib/utils";
import { useDestinatario } from "./dati";
import { ContenutoDialogo } from "./Dialogo";

type Props = Soggetto & {
  etichetta?: string;
  size?: "default" | "sm";
  motivoVisibile?: boolean;
};

export const BottoneWhatsapp = ({ etichetta = "WhatsApp", size = "default", motivoVisibile = false, ...soggetto }: Props) => {
  const d = useDestinatario(soggetto as Soggetto);
  const [aperto, setAperto] = useState(false);
  const faccia = (
    <>
      <MessageCircle />
      {etichetta}
    </>
  );

  if (!d.pronto || !d.numero) {
    const motivo = d.pronto ? d.motivo : "Cerco il telefono.";
    if (motivoVisibile) {
      return (
        <span className="inline-flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size={size} disabled>
            {faccia}
          </Button>
          <span data-motivo={motivo} className="text-ink2">
            {motivo}
          </span>
        </span>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              data-motivo={motivo}
              aria-label={`${etichetta}: ${motivo}`}
              className="inline-flex cursor-not-allowed rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <Button variant="outline" size={size} disabled tabIndex={-1}>
            {faccia}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{motivo}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger data-bottone-whatsapp className={cn(buttonVariants({ variant: "outline", size }))}>
        {faccia}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-4 sm:max-w-[520px]">
        <ContenutoDialogo d={d} onChiudi={() => setAperto(false)} />
      </DialogContent>
    </Dialog>
  );
};
