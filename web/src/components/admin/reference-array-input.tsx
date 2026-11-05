import * as React from "react";
import type { ReactElement } from "react";
import type { InputProps, UseReferenceArrayInputParams } from "ra-core";
import {
  useReferenceArrayInputController,
  ResourceContextProvider,
  ChoicesContextProvider,
} from "ra-core";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";

export const ReferenceArrayInput = (props: ReferenceArrayInputProps) => {
  const {
    children = defaultChildren,
    reference,
    sort,
    filter = defaultFilter,
  } = props;
  if (React.Children.count(children) !== 1) {
    throw new Error(
      "<ReferenceArrayInput> only accepts a single child (like <AutocompleteArrayInput>)",
    );
  }

  const controllerProps = useReferenceArrayInputController({
    ...props,
    sort,
    filter,
  });

  return (
    <ResourceContextProvider value={reference}>
      <ChoicesContextProvider value={controllerProps}>
        {children}
      </ChoicesContextProvider>
    </ResourceContextProvider>
  );
};

const defaultChildren = <AutocompleteArrayInput />;
const defaultFilter = {};

export interface ReferenceArrayInputProps
  extends InputProps, UseReferenceArrayInputParams {
  children?: ReactElement;
}
