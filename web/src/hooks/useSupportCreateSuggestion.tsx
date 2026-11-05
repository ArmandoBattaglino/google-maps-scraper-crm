import * as React from "react";
import type { ChangeEvent, ReactElement } from "react";
import {
  createContext,
  isValidElement,
  useContext,
  useRef,
  useState,
} from "react";
import type { Identifier, OptionText } from "ra-core";
import { useTranslate } from "ra-core";
import set from "lodash/set";

export const useSupportCreateSuggestion = <T = unknown,>(
  options: SupportCreateSuggestionOptions<T>,
): UseSupportCreateValue<T> => {
  const {
    create,
    createLabel = "ra.action.create",
    createItemLabel,
    createValue = "@@ra-create",
    createHintValue = "@@ra-create-hint",
    optionText = "name",
    filter,
    handleChange,
    onCreate,
  } = options;

  const translate = useTranslate();
  const [renderOnCreate, setRenderOnCreate] = useState(false);
  const filterRef = useRef(filter);

  return {
    createId: createValue,
    createHintId: createHintValue,
    getCreateItem: (filter?: string) => {
      filterRef.current = filter;

      return set(
        {
          id: createItemLabel && !filter ? createHintValue : createValue,
        },
        typeof optionText === "string" ? optionText : "name",
        filter && createItemLabel
          ? typeof createItemLabel === "string"
            ? translate(createItemLabel, {
                item: filter,
                _: createItemLabel,
              })
            : createItemLabel(filter)
          : typeof createLabel === "string"
            ? translate(createLabel, { _: createLabel })
            : createLabel,
      );
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleChange: async (eventOrValue: MouseEvent | any) => {
      const value = eventOrValue?.target?.value || eventOrValue;
      const finalValue = Array.isArray(value) ? [...value].pop() : value;

      if (finalValue?.id === createValue || finalValue === createValue) {
        if (!isValidElement(create)) {
          if (!onCreate) {
            throw new Error(
              "To create a new option, you must pass an onCreate function or a create element.",
            );
          }
          const newSuggestion = await onCreate(filter);
          if (newSuggestion) {
            handleChange(newSuggestion);
            return;
          }
        } else {
          setRenderOnCreate(true);
          return;
        }
      }
      handleChange(eventOrValue);
    },
    createElement:
      renderOnCreate && isValidElement(create) ? (
        <CreateSuggestionContext.Provider
          value={{
            filter: filterRef.current,
            onCancel: () => setRenderOnCreate(false),
            onCreate: (item) => {
              setRenderOnCreate(false);
              handleChange(item as T);
            },
          }}
        >
          {create}
        </CreateSuggestionContext.Provider>
      ) : null,
    getOptionDisabled: (option) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (option as any)?.id === createHintValue || option === createHintValue,
  };
};

export interface SupportCreateSuggestionOptions<T = unknown> {
  create?: ReactElement;
  createValue?: string;
  createHintValue?: string;
  createLabel?: React.ReactNode;
  createItemLabel?: string | ((filter: string) => React.ReactNode);
  filter?: string;
  handleChange: (value: T) => void;
  onCreate?: OnCreateHandler;
  optionText?: OptionText;
}

export interface UseSupportCreateValue<T = unknown> {
  createId: string;
  createHintId: string;
  getCreateItem: (filterValue?: string) => {
    id: Identifier;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  handleChange: (eventOrValue: ChangeEvent | T) => Promise<void>;
  createElement: ReactElement | null;
  getOptionDisabled: (option: T) => boolean;
}

const CreateSuggestionContext = createContext<
  CreateSuggestionContextValue | undefined
>(undefined);

interface CreateSuggestionContextValue<T = unknown> {
  filter?: string;
  onCreate: (choice: T) => void;
  onCancel: () => void;
}

export const useCreateSuggestionContext = () => {
  const context = useContext(CreateSuggestionContext);
  if (!context) {
    throw new Error(
      "useCreateSuggestionContext must be used inside a CreateSuggestionContext.Provider",
    );
  }
  return context;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OnCreateHandler = (filter?: string) => any | Promise<any>;
