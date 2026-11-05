import * as React from "react";
import type { InputProps } from "ra-core";
import { useInput, FieldTitle, useEvent, useResourceContext } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { cn } from "@/lib/utils";

export const DateInput = (props: DateInputProps) => {
  const {
    className,
    inputClassName,
    defaultValue,
    format = defaultFormat,
    label,
    source,
    helperText,
    onChange,
    onFocus,
    validate,
    disabled,
    readOnly,
    ...rest
  } = props;

  const resource = useResourceContext(props);

  const {
    field,
    fieldState: _fieldState,
    id,
    isRequired,
  } = useInput({
    defaultValue,
    source,
    validate,
    disabled,
    readOnly,
    format,
    ...rest,
  });
  const localInputRef = React.useRef<HTMLInputElement>(null);
  const initialDefaultValueRef = React.useRef(field.value);
  const [inputKey, setInputKey] = React.useState(1);
  const wasLastChangedByInput = React.useRef(false);

  React.useEffect(() => {
    if (wasLastChangedByInput.current) {
      wasLastChangedByInput.current = false;
      return;
    }

    const hasNewValueFromForm =
      localInputRef.current?.value !== field.value &&
      !(localInputRef.current?.value === "" && field.value == null);

    if (hasNewValueFromForm) {
      initialDefaultValueRef.current = field.value;
      setInputKey((r) => r + 1);
      wasLastChangedByInput.current = false;
    }
  }, [setInputKey, field.value]);

  const { onBlur: onBlurFromField } = field;
  const hasFocus = React.useRef(false);

  const handleChange = useEvent(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(event);
      }
      if (
        typeof event.target === "undefined" ||
        typeof event.target.value === "undefined"
      ) {
        return;
      }
      const target = event.target;
      const newValue = target.value;
      const isNewValueValid =
        newValue === "" ||
        (target.valueAsDate != null &&
          !isNaN(new Date(target.valueAsDate).getTime()));

      if (newValue !== "" && newValue != null && isNewValueValid) {
        field.onChange(newValue);
        wasLastChangedByInput.current = true;
      }
    },
  );

  const handleFocus = useEvent((event: React.FocusEvent<HTMLInputElement>) => {
    if (onFocus) {
      onFocus(event);
    }
    hasFocus.current = true;
  });

  const handleBlur = useEvent(() => {
    hasFocus.current = false;

    if (!localInputRef.current) {
      return;
    }

    const newValue = localInputRef.current.value;
    const isNewValueValid =
      newValue === "" ||
      (localInputRef.current.valueAsDate != null &&
        !isNaN(new Date(localInputRef.current.valueAsDate).getTime()));

    if (isNewValueValid && field.value !== newValue) {
      field.onChange(newValue ?? "");
    }

    if (onBlurFromField) {
      onBlurFromField();
    }
  });

  const { ref, name } = field;
  const inputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref && node) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
      localInputRef.current = node;
    },
    [ref],
  );

  return (
    <FormField id={id} className={className} name={name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <Input
          ref={inputRef}
          defaultValue={format(initialDefaultValueRef.current) ?? ""}
          key={inputKey}
          type="date"
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            "ra-input",
            `ra-input-${source}`,
            "scheme-light dark:scheme-dark relative [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:opacity-100 appearance-none",
            inputClassName,
          )}
          disabled={disabled || readOnly}
          readOnly={readOnly}
          {...rest}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export type DateInputProps = InputProps & {
  inputClassName?: string;
} & Omit<React.ComponentProps<"input">, "label" | "defaultValue">;

const convertDateToString = (value: Date) => {
  if (!(value instanceof Date) || isNaN(value.getDate())) return "";
  const localDate = new Date(value.getTime());
  const pad = "00";
  const yyyy = localDate.getFullYear().toString();
  const MM = (localDate.getMonth() + 1).toString();
  const dd = localDate.getDate().toString();
  return `${yyyy}-${(pad + MM).slice(-2)}-${(pad + dd).slice(-2)}`;
};

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const defaultFormat = (value: string | Date | number) => {
  if (value == null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return convertDateToString(value);
  }

  if (typeof value === "string") {
    if (dateRegex.test(value)) {
      return value;
    }
  }

  return convertDateToString(new Date(value));
};
