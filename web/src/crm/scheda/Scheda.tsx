import type { ReactNode } from "react";
import { LinkBase } from "ra-core";
import { Breadcrumb, BreadcrumbItem, BreadcrumbPage } from "@/components/admin/breadcrumb";
import { cn } from "@/lib/utils";

export const LayoutScheda = ({ lato, children }: { lato: ReactNode; children: ReactNode }) => (
  <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]" data-pagina="scheda">
    <div className="min-w-0 px-5 pt-6 pb-12 md:px-8 lg:border-r lg:border-line">{children}</div>
    <aside aria-label="Oggetti collegati" className="bg-rec-side px-5 pt-5 pb-12">
      {lato}
    </aside>
  </div>
);

export const PercorsoScheda = ({ lista, listaUrl, nome }: { lista: string; listaUrl: string; nome: string }) => (
  <Breadcrumb>
    <BreadcrumbItem>
      <LinkBase to="/">Oggi</LinkBase>
    </BreadcrumbItem>
    <BreadcrumbItem>
      <LinkBase to={listaUrl}>{lista}</LinkBase>
    </BreadcrumbItem>
    <BreadcrumbPage>{nome}</BreadcrumbPage>
  </Breadcrumb>
);

export const Identita = ({
  segno,
  titolo,
  sotto,
  etichette,
  azioni,
}: {
  segno: ReactNode;
  titolo: ReactNode;
  sotto?: ReactNode;
  etichette?: ReactNode;
  azioni?: ReactNode;
}) => (
  <div className="flex flex-wrap items-start gap-3.5">
    {segno}
    <div className="min-w-0 flex-1 basis-60">
      {titolo}
      {sotto ? <p className="mt-[3px] text-ink2">{sotto}</p> : null}
      {etichette ? <div className="mt-3 flex flex-wrap items-center gap-2">{etichette}</div> : null}
    </div>
    {azioni ? <div className="flex gap-2">{azioni}</div> : null}
  </div>
);

export const GrigliaCampi = ({ children, stretta = false }: { children: ReactNode; stretta?: boolean }) => (
  <dl className={cn("grid grid-cols-1 gap-x-7 gap-y-0.5 md:grid-cols-2", stretta ? "mt-1" : "mt-[22px]")}>{children}</dl>
);

export const Puntini = ({ etichetta = "Carico" }: { etichetta?: string }) => (
  <span role="status" aria-label={etichetta} className="animate-pulse tracking-[0.2em] text-mute">
    ...
  </span>
);

export const SchedaMancante = ({ cosa, listaUrl, lista }: { cosa: string; listaUrl: string; lista: string }) => (
  <div className="px-8 py-12" role="alert">
    <h1 className="text-titolo font-semibold text-ink">{cosa} non trovata</h1>
    <p className="mt-2 text-ink2">
      Forse è stata tolta.{" "}
      <LinkBase to={listaUrl} className="text-acc-ink underline-offset-3 hover:underline">
        Torna a {lista}
      </LinkBase>
    </p>
  </div>
);
