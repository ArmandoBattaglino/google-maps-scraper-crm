import type {
  CoreAdminUIProps,
  CoreAdminContextProps,
  CoreAdminProps,
} from "ra-core";
import { CoreAdminUI, CoreAdminContext, localStorageStore } from "ra-core";
import { i18nProvider as defaultI18nProvider } from "@/lib/i18nProvider";
import { AccessDenied } from "@/components/admin/access-denied";
import { Layout } from "@/components/admin/layout";
import { NotFound } from "@/components/admin/not-found";
import { Ready } from "@/components/admin/ready";
import { ThemeProvider } from "@/components/admin/theme-provider";
import { AuthCallback } from "@/components/admin/authentication";

const defaultStore = localStorageStore();

const AdminContext = (props: CoreAdminContextProps) => (
  <CoreAdminContext {...props} />
);

const AdminUI = (props: CoreAdminUIProps) => {
  const { disableTelemetry, ...rest } = props;
  void disableTelemetry;

  return (
    <ThemeProvider>
      <CoreAdminUI
        layout={Layout}
        loginPage={false}
        ready={Ready}
        authCallbackPage={AuthCallback}
        disableTelemetry
        {...rest}
      />
    </ThemeProvider>
  );
};

export const Admin = (props: CoreAdminProps) => {
  const {
    accessDenied = AccessDenied,
    authCallbackPage = AuthCallback,
    authenticationError,
    authProvider,
    basename,
    catchAll = NotFound,
    children,
    dashboard,
    dataProvider,
    disableTelemetry,
    error,
    i18nProvider = defaultI18nProvider,
    layout = Layout,
    loading,
    loginPage = false,
    queryClient,
    ready = Ready,
    requireAuth,
    routerProvider,
    store = defaultStore,
    title = "CRM",
  } = props;
  return (
    <AdminContext
      authProvider={authProvider}
      basename={basename}
      dataProvider={dataProvider}
      i18nProvider={i18nProvider}
      queryClient={queryClient}
      routerProvider={routerProvider}
      store={store}
    >
      <AdminUI
        accessDenied={accessDenied}
        authCallbackPage={authCallbackPage}
        authenticationError={authenticationError}
        catchAll={catchAll}
        dashboard={dashboard}
        disableTelemetry={disableTelemetry}
        error={error}
        layout={layout}
        loading={loading}
        loginPage={loginPage}
        ready={ready}
        requireAuth={requireAuth}
        title={title}
      >
        {children}
      </AdminUI>
    </AdminContext>
  );
};
