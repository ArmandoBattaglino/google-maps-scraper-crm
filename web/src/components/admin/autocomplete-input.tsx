/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { useCallback, useId } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type {
  ChoicesProps,
  InputProps,
  SupportCreateSuggestionOptions,
} from "ra-core";
import {
  useChoices,
  useChoicesContext,
  useGetRecordRepresentation,
  useInput,
  useTranslate,
  FieldTitle,
  useEvent,
  useSupportCreateSuggestion,
} from "ra-core";
import { InputHelperText } from "./input-helper-text";
import { ClearInputButton } from "./clear-input-button";

export const AutocompleteInput = (
  props: Omit<InputProps, "source"> &
    Omit<SupportCreateSuggestionOptions, "handleChange" | "filter"> &
    Partial<Pick<InputProps, "source">> &
    ChoicesProps & {
      className?: string;
      clearable?: boolean;
      disableValue?: string;
      filterToQuery?: (searchText: string) => any;
      translateChoice?: boolean;
      placeholder?: string;
      inputText?:
        React.ReactNode | ((option: any | undefined) => React.ReactNode);
    } & Pick<PopoverPrimitive.Root.Props, "modal">,
) => {
  const {
    clearable = false,
    filterToQuery = DefaultFilterToQuery,
    inputText,
    create,
    createValue,
    createLabel,
    createHintValue,
    createItemLabel,
    onCreate,
    optionText,
    modal,
  } = props;
  const {
    allChoices = [],
    source,
    resource,
    isFromReference,
    setFilters,
  } = useChoicesContext(props);
  const { id, field, isRequired } = useInput({ ...props, source });
  const uniqueId = useId();
  const translate = useTranslate();
  const { placeholder = translate("ra.action.search", { _: "Search..." }) } =
    props;
  const hasLabel = props.label !== false;
  const accessibleName =
    !hasLabel && props.placeholder ? placeholder : undefined;
  const isClearable = clearable && !isRequired && !!field.value;

  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const { getChoiceText, getChoiceValue } = useChoices({
    optionText:
      props.optionText ?? (isFromReference ? getRecordRepresentation : "name"),
    optionValue: props.optionValue ?? "id",
    disableValue: props.disableValue,
    translateChoice: props.translateChoice ?? !isFromReference,
  });

  const [filterValue, setFilterValue] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const [open, setOpen] = React.useState(false);
  const selectedChoice = allChoices.find(
    (choice) => getChoiceValue(choice) === field.value,
  );

  const getInputText = useCallback(
    (selectedChoice: any) => {
      if (typeof inputText === "function") {
        return inputText(selectedChoice);
      }
      if (inputText !== undefined) {
        return inputText;
      }
      return getChoiceText(selectedChoice);
    },
    [inputText, getChoiceText],
  );

  const handleOpenChange = useEvent((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setFilters(filterToQuery(""));
    }
  });

  const handleReset = useEvent(() => {
    field.onChange("");
    setFilterValue("");
    if (isFromReference) {
      setFilters(filterToQuery(""));
    }
    setOpen(false);
  });

  const handleChange = useCallback(
    (choice: any) => {
      const value = getChoiceValue(choice);
      if (value === (createValue ?? "@@ra-create")) {
        return;
      }
      if (field.value === value && !isRequired) {
        handleReset();
        return;
      }
      field.onChange(value);
      setOpen(false);
    },
    [field, getChoiceValue, createValue, isRequired, handleReset, setOpen],
  );

  const {
    getCreateItem,
    handleChange: handleChangeWithCreateSupport,
    createElement,
    getOptionDisabled,
  } = useSupportCreateSuggestion({
    create,
    createLabel,
    createValue,
    createHintValue,
    createItemLabel,
    onCreate,
    handleChange,
    optionText,
    filter: filterValue,
  });

  const createItem =
    (create || onCreate) && (filterValue !== "" || createLabel)
      ? getCreateItem(filterValue)
      : null;
  let finalChoices = allChoices;
  if (createItem) {
    finalChoices = [...finalChoices, createItem];
  }

  return (
    <>
      <FormField className={props.className} id={id} name={field.name}>
        {props.label !== false && (
          <FormLabel id={uniqueId}>
            <FieldTitle
              label={props.label}
              source={props.source ?? source}
              resource={resource}
              isRequired={isRequired}
            />
          </FormLabel>
        )}
        <Popover open={open} onOpenChange={handleOpenChange} modal={modal}>
          <div className="relative">
            <PopoverTrigger
              render={
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={accessibleName}
                    aria-labelledby={hasLabel ? uniqueId : undefined}
                    className={cn(
                      "w-full justify-between h-auto py-1.75 font-normal",
                      isClearable && "pr-9",
                    )}
                  >
                    <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden text-left">
                      {selectedChoice ? (
                        getInputText(selectedChoice)
                      ) : (
                        <span className="text-muted-foreground">
                          {placeholder}
                        </span>
                      )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              }
            />
            {isClearable && (
              <ClearInputButton className="right-8" onClick={handleReset} />
            )}
          </div>
          <PopoverContent className="w-full max-w-(--anchor-width) p-0">
            {}
            <Command shouldFilter={!isFromReference}>
              <CommandInput
                placeholder="Search..."
                value={filterValue}
                onValueChange={(filter) => {
                  setFilterValue(filter);
                  requestAnimationFrame(() => {
                    listRef.current?.scrollTo(0, 0);
                  });
                  if (isFromReference) {
                    setFilters(filterToQuery(filter));
                  }
                }}
              />
              <CommandList ref={listRef}>
                <CommandEmpty>No matching item found.</CommandEmpty>
                <CommandGroup>
                  {finalChoices.map((choice) => {
                    const isCreateItem =
                      !!createItem && choice?.id === createItem.id;
                    const disabled = getOptionDisabled(choice);

                    const choiceText = getChoiceText(
                      isCreateItem ? createItem : choice,
                    );

                    return (
                      <CommandItem
                        key={getChoiceValue(choice)}
                        keywords={
                          isCreateItem || React.isValidElement(choiceText)
                            ? undefined
                            : [choiceText]
                        }
                        value={
                          isCreateItem
                            ?
                              `?${filterValue}?`
                            : getChoiceValue(choice)
                        }
                        onSelect={() => handleChangeWithCreateSupport(choice)}
                        disabled={disabled}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            field.value === getChoiceValue(choice)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {choiceText}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <InputHelperText helperText={props.helperText} />
        <FormError />
      </FormField>
      {createElement}
    </>
  );
};

const DefaultFilterToQuery = (searchText: string) => ({ q: searchText });
