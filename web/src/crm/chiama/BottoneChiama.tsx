import { LinkBase } from "ra-core";
import { Play } from "lucide-react";
import { useOggi } from "@/crm/oggi/dati";
import { cn } from "@/lib/utils";

const NERO =
  "inline-flex items-center gap-2 rounded-[7px] bg-ink font-medium text-bg outline-none hover:bg-ink2 focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-3.5 [&_svg]:fill-current";

export const BottoneChiama = ({ vuota = false, className }: { vuota?: boolean; className?: string }) =>
  vuota ? (
    <span data-chiama-vuota className={cn("inline-flex h-[34px] items-center text-cella whitespace-nowrap text-mute", className)}>
      Coda vuota
    </span>
  ) : (
    <LinkBase to="/chiama" data-chiama className={cn(NERO, "h-[34px] px-3.5", className)}>
      <Play />
      Chiama
    </LinkBase>
  );

export const BottoneChiamaBarra = () => {
  const { data } = useOggi("me");
  const n = data?.da_chiamare.n;
  return (
    <LinkBase
      to="/chiama"
      data-chiama-barra
      aria-label={n === undefined ? "Chiama" : `Chiama, ${n} in coda`}
      className={cn(NERO, "mt-3 w-full px-2.5 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0")}
    >
      <Play />
      <span className="group-data-[collapsible=icon]:hidden">Chiama</span>
      {n === undefined ? null : (
        <small className="ml-auto text-xs font-normal tabular-nums opacity-70 group-data-[collapsible=icon]:hidden">
          {n.toLocaleString("it-IT")} in coda
        </small>
      )}
    </LinkBase>
  );
};
