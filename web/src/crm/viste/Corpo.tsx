import { lazy, Suspense } from "react";
import { Puntini } from "./forme";
import { KanbanVista } from "./Kanban/KanbanVista";
import { TabellaVista } from "./Tabella/TabellaVista";
import type { StatoPagina } from "./useStatoVista";

const CalendarioVista = lazy(() => import("./Calendario/CalendarioVista"));
const MappaVista = lazy(() => import("./Mappa/MappaVista"));

export const Corpo = ({ pagina }: { pagina: StatoPagina }) => {
  const { modo } = pagina.stato;
  if (modo === "kanban") return <KanbanVista pagina={pagina} />;
  if (modo === "calendario" || modo === "mappa") {
    return (
      <Suspense fallback={<Puntini etichetta="Carico la vista" />}>
        {modo === "calendario" ? <CalendarioVista pagina={pagina} /> : <MappaVista pagina={pagina} />}
      </Suspense>
    );
  }
  return <TabellaVista pagina={pagina} />;
};
