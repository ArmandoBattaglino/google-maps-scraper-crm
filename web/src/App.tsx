import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomRoutes, HttpError, Resource } from "ra-core";
import { Route } from "react-router";
import { OriginiLista } from "@/crm/origini/OriginiLista";
import { Admin } from "@/components/admin/admin";
import { AziendaNuova } from "@/crm/aziende/AziendaNuova";
import { AziendaScheda } from "@/crm/aziende/AziendaScheda";
import { AziendeLista } from "@/crm/aziende/AziendeLista";
import { PaginaCronologia } from "@/crm/attivita/PaginaCronologia";
import { PaginaChiama } from "@/crm/chiama/PaginaChiama";
import { PaginaCompiti } from "@/crm/compiti/PaginaCompiti";
import { CampiGestione } from "@/crm/campi/CampiGestione";
import { i18nProvider } from "@/crm/i18n";
import { RouterConPannello } from "@/crm/pannello/Instradamento";
import { ElencoOggi } from "@/crm/oggi/ElencoOggi";
import { PaginaOggi } from "@/crm/oggi/PaginaOggi";
import { BancoTag } from "@/crm/tag/BancoTag";
import { PersonaModifica } from "@/crm/persone/PersonaModifica";
import { PersonaNuova } from "@/crm/persone/PersonaNuova";
import { PersonaScheda } from "@/crm/persone/PersonaScheda";
import { PersoneLista } from "@/crm/persone/PersoneLista";
import { Guscio } from "@/layout/Guscio";
import { TrattativaScheda } from "@/crm/trattative/TrattativaScheda";
import { TrattativeLista } from "@/crm/trattative/TrattativeLista";
import { PaginaViste } from "@/crm/viste/PaginaViste";
import { useMarca } from "@/hooks/useMarca";
import { Socio } from "@/layout/Socio";
import { voce } from "@/layout/voci";
import { authProvider } from "@/providers/accesso";
import { dataProvider } from "@/providers/dati";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (volte, e) => !(e instanceof HttpError && e.status < 500) && volte < 3 } },
});

const Crm = () => {
  const { nome } = useMarca();
  return (
    <RouterConPannello basename="/crm">
      <Admin
        title={nome}
        dataProvider={dataProvider}
        authProvider={authProvider}
        i18nProvider={i18nProvider}
        queryClient={queryClient}
        layout={Guscio}
        dashboard={PaginaOggi}
        disableTelemetry
      >
        <Resource
          name="aziende"
          icon={voce("aziende").icona}
          list={AziendeLista}
          edit={AziendaScheda}
          create={AziendaNuova}
          recordRepresentation="nome"
        />
        <Resource
          name="persone"
          icon={voce("persone").icona}
          list={PersoneLista}
          edit={PersonaScheda}
          create={PersonaNuova}
          recordRepresentation="nome"
        >
          <Route path=":id/modifica" element={<PersonaModifica />} />
        </Resource>
        <Resource name="trattative" icon={voce("trattative").icona} list={TrattativeLista} edit={TrattativaScheda} />
        <Resource name="origini" icon={voce("origini").icona} list={OriginiLista} />
        <CustomRoutes noLayout>
          <Route path="/chiama" element={<PaginaChiama />} />
        </CustomRoutes>
        <CustomRoutes>
          <Route path="/oggi/:chiave" element={<ElencoOggi />} />
          <Route path="/compiti" element={<PaginaCompiti />} />
          <Route path="/viste" element={<PaginaViste />} />
          <Route path="/campi" element={<CampiGestione />} />
          <Route path="/tag/:risorsa?" element={<BancoTag />} />
          <Route path="/cronologia/:risorsa/:id" element={<PaginaCronologia />} />
        </CustomRoutes>
      </Admin>
    </RouterConPannello>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Socio>
      <Crm />
    </Socio>
  </QueryClientProvider>
);

export default App;
