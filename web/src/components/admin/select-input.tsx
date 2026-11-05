import { ClearInputButton } from "@/components/admin/clear-input-button";
import type {
  ChoicesProps,
  InputProps,
  SupportCreateSuggestionOptions,
} from "ra-core";
import {
  FieldTitle,
  useChoices,
  useChoicesContext,
  useGetRecordRepresentation,
  useInput,
  useSupportCreateSuggestion,
  useTranslate,
} from "ra-core";
import type { ComponentProps, ReactElement } from "react";
import { useCallback, useEffect, useId } from "react";

import { FormError, FormField, FormLabel } from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const SelectInput = (props: SelectInputProps) => {
  const {
    choices: choicesProp,
    isLoading: isLoadingProp,
    isFetching: isFetchingProp,
    isPending: isPendingProp,
    resource: resourceProp,
    source: sourceProp,

    optionText,
    optionValue,
    disableValue = "disabled",
    translateChoice,
    createValue,
    createHintValue,

    alwaysOn,
    defaultValue,
    format,
    label,
    helperText,
    name,
    onBlur,
    onChange,
    parse,
    validate,
    readOnly,
    disabled,

    className,
    emptyText = "",
    emptyValue = "",
    filter: _filter,
    create,
    createLabel,
    onCreate,

    ...rest
  } = props;
  const translate = useTranslate();

  useEffect(() => {
    if (emptyValue == null) {
      throw new Error(
        `emptyValue being set to null or undefined is not supported. Use parse to turn the empty string into null.`,
      );
    }
  }, [emptyValue]);

  const {
    allChoices,
    isPending,
    error: fetchError,
    source,
    resource,
    isFromReference,
  } = useChoicesContext({
    choices: choicesProp,
    isLoading: isLoadingProp,
    isFetching: isFetchingProp,
    isPending: isPendingProp,
    resource: resourceProp,
    source: sourceProp,
  });

  if (source === undefined) {
    throw new Error(
      `If you're not wrapping the SelectInput inside a ReferenceInput, you must provide the source prop`,
    );
  }

  if (!isPending && !fetchError && allChoices === undefined) {
    throw new Error(
      `If you're not wrapping the SelectInput inside a ReferenceInput, you must provide the choices prop`,
    );
  }

  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const { getChoiceText, getChoiceValue, getDisableValue } = useChoices({
    optionText:
      optionText ?? (isFromReference ? getRecordRepresentation : undefined),
    optionValue,
    disableValue,
    translateChoice: translateChoice ?? !isFromReference,
    createValue,
    createHintValue,
  });
  const labelId = useId();
  const { id, field, isRequired } = useInput({
    alwaysOn,
    defaultValue,
    format,
    label,
    helperText,
    name,
    onBlur,
    onChange,
    parse,
    resource,
    source,
    validate,
    readOnly,
    disabled,
  });

  const renderEmptyItemOption = useCallback(() => {
    return typeof emptyText === "string"
      ? emptyText === ""
        ? " "
        : translate(emptyText, { _: emptyText })
      : emptyText;
  }, [emptyText, translate]);

  const renderMenuItemOption = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (choice: any) => getChoiceText(choice),
    [getChoiceText],
  );

  const handleChange = useCallback(
    async (value: string) => {
      if (value === emptyValue) {
        field.onChange(emptyValue);
      } else {
        const choice = allChoices?.find(
          (choice) => String(getChoiceValue(choice)) === value,
        );
        field.onChange(choice ? getChoiceValue(choice) : value);
      }
    },
    [field, getChoiceValue, emptyValue, allChoices],
  );

  const {
    getCreateItem,
    handleChange: handleChangeWithCreateSupport,
    createElement,
  } = useSupportCreateSuggestion({
    create,
    createLabel,
    createValue,
    createHintValue,
    onCreate,
    handleChange,
    optionText,
  });

  if (isPending) {
    return (
      <FormField
        id={id}
        name={field.name}
        className={cn("w-full min-w-20", className)}
      >
        {label !== "" && label !== false && (
          <FormLabel id={labelId}>
            <FieldTitle
              label={label}
              source={source}
              resource={resourceProp}
              isRequired={isRequired}
            />
          </FormLabel>
        )}
        <div className="relative">
          <Skeleton className="w-full h-9" />
        </div>
        <InputHelperText helperText={helperText} />
        <FormError />
      </FormField>
    );
  }

  const createItem = create || onCreate ? getCreateItem() : null;
  let finalChoices = fetchError ? [] : allChoices;
  if (create || onCreate) {
    finalChoices = [...finalChoices, createItem];
  }

  const handleReset = () => {
    field.onChange(emptyValue);
  };

  const isClearable =
    !field.disabled && !!field.value && field.value !== emptyValue;

  return (
    <>
      <FormField
        id={id}
        name={field.name}
        className={cn("w-full min-w-20", className)}
        {...rest}
      >
        {label !== "" && label !== false && (
          <FormLabel id={labelId}>
            <FieldTitle
              label={label}
              source={source}
              resource={resourceProp}
              isRequired={isRequired}
            />
          </FormLabel>
        )}
        <div className="relative">
          <Select
            value={field.value?.toString() || emptyValue}
            onValueChange={handleChangeWithCreateSupport}
          >
            <SelectTrigger
              className={cn("w-full transition-all hover:bg-accent")}
              disabled={field.disabled}
              aria-labelledby={labelId}
            >
              <SelectValue
                placeholder={renderEmptyItemOption()}
                className={cn(isClearable && "pr-6")}
              >
                {(value: string | null) => {
                  if (!value || value === emptyValue) {
                    return renderEmptyItemOption();
                  }
                  const choice = finalChoices?.find(
                    (choice) =>
                      choice && getChoiceValue(choice)?.toString() === value,
                  );
                  return choice ? renderMenuItemOption(choice) : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {finalChoices?.map((choice) => {
                if (!choice) return null;
                const value = getChoiceValue(choice);
                const isDisabled = getDisableValue(choice);

                return (
                  <SelectItem
                    key={value}
                    value={value?.toString()}
                    disabled={isDisabled}
                  >
                    {renderMenuItemOption(
                      !!createItem && choice?.id === createItem.id
                        ? createItem
                        : choice,
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {isClearable ? (
            <ClearInputButton className="right-7" onClick={handleReset} />
          ) : null}
        </div>
        <InputHelperText helperText={helperText} />
      </FormField>
      {createElement}
    </>
  );
};

export type SelectInputProps = ChoicesProps &
  Partial<InputProps> &
  Omit<SupportCreateSuggestionOptions, "handleChange"> & {
    emptyText?: string | ReactElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emptyValue?: any;
    onChange?: (value: string) => void;
  } & Omit<ComponentProps<typeof FormField>, "id" | "name" | "children">;
