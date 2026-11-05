import { LinkBase } from "ra-core";
import { NOME_CHIAVE, type Doppione } from "./doppioni";

export const AvvisoDoppioni = ({ doppioni }: { doppioni: Doppione[] }) => (
  <div role="alert" data-avviso="doppioni" className="rounded-md bg-warn-soft px-3 py-2 text-warn">
    <p className="font-medium">Esiste già</p>
    <ul className="mt-1 space-y-0.5">
      {doppioni.map((d) => (
        <li key={d.id}>
          <LinkBase to={`/aziende/${d.id}`} className="font-medium underline underline-offset-3">
            {d.nome}
          </LinkBase>
          {d.comune ? `, ${d.comune}` : ""} ({NOME_CHIAVE[d.chiave]})
        </li>
      ))}
    </ul>
  </div>
);
