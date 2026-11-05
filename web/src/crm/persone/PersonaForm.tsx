import { maxLength, required } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SimpleForm } from "@/components/admin/simple-form";
import { TextInput } from "@/components/admin/text-input";
import { nomeNonVuoto } from "./campi";

export const PersonaForm = () => (
  <SimpleForm>
    <TextInput source="nome" validate={[required(), nomeNonVuoto, maxLength(200)]} />
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput source="ruolo" validate={maxLength(120)} />
      <div className="[&_[role=combobox]]:h-[30px] [&_[role=combobox]]:px-2 [&_[role=combobox]]:py-1">
        <ReferenceInput source="azienda_id" reference="aziende" sort={{ field: "nome", order: "ASC" }} perPage={25}>
          <AutocompleteInput optionText="nome" />
        </ReferenceInput>
      </div>
      <TextInput source="telefono" validate={maxLength(40)} />
      <TextInput source="email" type="email" validate={maxLength(254)} />
    </div>
  </SimpleForm>
);
