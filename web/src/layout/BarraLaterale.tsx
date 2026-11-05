import { Fragment } from "react";
import { LinkBase, useGetList, useMatch } from "ra-core";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { BottoneChiamaBarra } from "@/crm/chiama/BottoneChiama";
import { BadgeCompiti } from "@/crm/compiti/BadgeCompiti";
import { useMarca } from "@/hooks/useMarca";
import { VOCI, type Voce } from "./voci";

export const BarraLaterale = () => {
  const { openMobile, setOpenMobile } = useSidebar();
  const { nome, iniziale } = useMarca();
  const chiudiSuMobile = () => openMobile && setOpenMobile(false);
  return (
    <Sidebar variant="sidebar" collapsible="icon" aria-label="Navigazione">
      <SidebarHeader className="px-2.5 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 font-semibold text-ink">
          <span className="grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-ink text-xs text-bg">
            {iniziale}
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">{nome}</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2.5">
        <SidebarMenu className="gap-0.5">
          {VOCI.map((v) => (
            <Fragment key={v.chiave}>
              {v.divisore ? <li role="separator" data-divisore className="mx-1 my-1.5 h-px bg-line" /> : null}
              <VoceBarra voce={v} onClick={chiudiSuMobile} />
            </Fragment>
          ))}
        </SidebarMenu>
        <div onClick={chiudiSuMobile}>
          <BottoneChiamaBarra />
        </div>
      </SidebarContent>
      <SidebarFooter className="p-0">
      </SidebarFooter>
    </Sidebar>
  );
};

const VoceBarra = ({ voce, onClick }: { voce: Voce; onClick: () => void }) => {
  const attiva = useMatch({ path: voce.percorso, end: voce.percorso === "/" });
  const Icona = voce.icona;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<LinkBase to={voce.percorso} state={{ _scrollToTop: true }} onClick={onClick} />}
        isActive={!!attiva}
        tooltip={voce.etichetta}
        aria-current={attiva ? "page" : undefined}
        data-voce={voce.chiave}
      >
        <Icona />
        <span className="truncate">{voce.etichetta}</span>
        {voce.conta ? <Conteggio risorsa={voce.conta} filtro={voce.contaFiltro} /> : null}
      </SidebarMenuButton>
      {voce.chiave === "compiti" ? <BadgeCompiti /> : null}
    </SidebarMenuItem>
  );
};

const Conteggio = ({ risorsa, filtro }: { risorsa: string; filtro?: Record<string, string> }) => {
  const { total, isPending, error } = useGetList(risorsa, { pagination: { page: 1, perPage: 1 }, filter: filtro });
  if (isPending || error || total === undefined) return null;
  return (
    <span className="ml-auto text-xs text-mute tabular-nums group-data-[collapsible=icon]:hidden">
      {total.toLocaleString("it-IT")}
    </span>
  );
};
