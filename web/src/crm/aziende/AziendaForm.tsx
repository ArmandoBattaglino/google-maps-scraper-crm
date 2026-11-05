import { useEffect, useState } from "react";
import { FieldTitle, required, useInput } from "ra-core";
import { useWatch } from "react-hook-form";
import { CancelButton } from "@/components/admin/cancel-button";
import { FormControl, FormError, FormField, FormLabel, SaveButton } from "@/components/admin/form";
import { FormToolbar, SimpleForm } from "@/components/admin/simple-form";
import { TextInput } from "@/components/admin/text-input";
import { DataOra } from "@/crm/DataOra";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scelta } from "@/crm/Scelta";
import { VOCI } from "@/crm/origini/voci";
import { AvvisoDoppioni } from "./AvvisoDoppioni";
import { verificaDoppioni, type Doppione } from "./doppioni";

const ControlloDoppioni = () => {
  const [nome, telefono, sito, piva, email] = useWatch({ name: ["nome", "telefono", "sito", "piva", "email"] });
  const [doppioni, setDoppioni] = useState<Doppione[]>([]);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      verificaDoppioni({ nome, telefono, sito, piva, email })
        .then((d) => vivo && setDoppioni(d))
        .catch(() => vivo && setDoppioni([]));
    }, 500);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [nome, telefono, sito, piva, email]);
  return (
    <>
      {doppioni.length ? <AvvisoDoppioni doppioni={doppioni} /> : null}
      <FormToolbar>
        <div className="flex flex-row justify-end gap-2">
          <CancelButton />
          <SaveButton label={doppioni.length ? "Crea lo stesso" : "ra.action.save"} />
        </div>
      </FormToolbar>
    </>
  );
};

const RichiamareIl = () => {
  const { id, field } = useInput({ source: "richiamare_il" });
  return (
    <FormField id={id} name={field.name}>
      <FormLabel>
        <FieldTitle source="richiamare_il" />
      </FormLabel>
      <FormControl>
        <DataOra id={id} etichetta="Da richiamare il" valore={field.value} onCambia={(v) => field.onChange(v)} />
      </FormControl>
      <FormError />
    </FormField>
  );
};

const voceObbligo = (_v: unknown, tutti: { voce?: string; da_chi?: string }) =>
  tutti.voce === "passaparola" && !tutti.da_chi?.trim() ? "Scrivi da chi è arrivata" : undefined;

const DaDoveArriva = () => {
  const voce = useInput({ source: "voce", defaultValue: "mano" });
  const daChi = useInput({ source: "da_chi", defaultValue: "", validate: voceObbligo });
  const conChi = voce.field.value === "passaparola" || voce.field.value === "evento";
  return (
    <div className="grid gap-4 md:grid-cols-2" data-da-dove-arriva>
      <div className="grid gap-1.5">
        <Label>Da dove arriva</Label>
        <Scelta etichetta="Da dove arriva" valore={voce.field.value} opzioni={VOCI} className="w-full" onScegli={(v) => voce.field.onChange(v)} />
      </div>
      {conChi ? (
        <div className="grid gap-1.5">
          <Label htmlFor="azienda-da-chi">{voce.field.value === "passaparola" ? "Da chi" : "Quale evento o incontro"}</Label>
          <Input id="azienda-da-chi" maxLength={200} value={daChi.field.value ?? ""} onChange={(e) => daChi.field.onChange(e.target.value)} onBlur={daChi.field.onBlur} />
          {daChi.fieldState.error ? <p className="text-xs text-danger">Scrivi da chi è arrivata</p> : null}
        </div>
      ) : null}
    </div>
  );
};

export const AziendaForm = () => (
  <SimpleForm toolbar={<ControlloDoppioni />} className="max-w-[640px]">
    <TextInput source="nome" validate={required()} />
    <DaDoveArriva />
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="telefono" />
      <TextInput source="email" type="email" />
      <TextInput source="sito" />
      <TextInput source="piva" />
      <TextInput source="indirizzo" />
      <TextInput source="comune" />
      <TextInput source="categoria" />
      <TextInput source="referente" />
      <RichiamareIl />
    </div>
    <TextInput source="note" multiline />
  </SimpleForm>
);
