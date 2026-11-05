import { SidebarMenuBadge } from "@/components/ui/sidebar";
import { useDovuti, useGiorno } from "./dati";

export const BadgeCompiti = () => {
  const giorno = useGiorno();
  const { data, isPending, error } = useDovuti(giorno);
  const n = data?.n;
  if (isPending || error || !n) return null;
  return (
    <SidebarMenuBadge
      data-badge-compiti={n}
      className="right-1.5 rounded-sm bg-acc-soft text-acc-ink peer-hover/menu-button:text-acc-ink peer-data-active/menu-button:text-acc-ink group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:h-3.5 group-data-[collapsible=icon]:min-w-3.5 group-data-[collapsible=icon]:px-0.5 group-data-[collapsible=icon]:text-[10px]"
    >
      {n.toLocaleString("it-IT")}
      <span className="sr-only"> compiti scaduti o di oggi</span>
    </SidebarMenuBadge>
  );
};
