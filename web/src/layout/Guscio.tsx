import type { ErrorInfo } from "react";
import { Suspense, useState } from "react";
import type { CoreLayoutProps } from "ra-core";
import { ErrorBoundary } from "react-error-boundary";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Notification } from "@/components/admin/notification";
import { Error } from "@/components/admin/error";
import { PannelloScheda } from "@/crm/pannello/PannelloScheda";
import { useEventi } from "@/hooks/useEventi";
import { BarraLaterale } from "./BarraLaterale";
import { Attesa } from "./Avviso";

export const Guscio = ({ children }: CoreLayoutProps) => {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | undefined>(undefined);
  useEventi();
  return (
    <SidebarProvider>
      <BarraLaterale />
      <main className="flex h-svh min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-testata shrink-0 items-center gap-2 border-b border-line px-3">
          <SidebarTrigger className="text-mute-deco hover:text-ink" aria-label="Apri o chiudi la barra" />
          <div className="flex flex-1 items-center text-ink2" id="breadcrumb" />
        </header>
        <ErrorBoundary
          onError={(_, info) => setErrorInfo(info)}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <Error error={error} errorInfo={errorInfo} resetErrorBoundary={resetErrorBoundary} />
          )}
        >
          <Suspense fallback={<Attesa etichetta="Carico la pagina" />}>
            <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
          </Suspense>
        </ErrorBoundary>
      </main>
      <PannelloScheda />
      <Notification />
    </SidebarProvider>
  );
};
