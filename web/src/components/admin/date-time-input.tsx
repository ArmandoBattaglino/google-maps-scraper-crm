import * as React from "react";
import clsx from "clsx";
import type { InputProps } from "ra-core";
import { useInput, FieldTitle } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { InputHelperText } from "@/components/admin/input-helper-text";

export const DateTimeInput = ({
  className,
  defaultValue,
  format = formatDateTime,
  parse = convertDateStringToISO,
  label,
  helperText,
  onBlur,
  onChange,
  onFocus,
  source,
  resource,
  validate,
  disabled,
  readOnly,
  ...rest
}: DateTimeInputProps) => {
  const { field, id, isRequired } = useInput({
    defaultValue,
    onBlur,
    resource,
    source,
    validate,
    disabled,
    readOnly,
    format,
    parse,
    ...rest,
  });
  const localInputRef = React.useRef<HTMLInputElement>(undefined);
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

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      newValue === "" || !isNaN(new Date(target.value).getTime());

    if (newValue !== "" && newValue != null && isNewValueValid) {
      field.onChange(newValue);
      wasLastChangedByInput.current = true;
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    if (onFocus) {
      onFocus(event);
    }
    hasFocus.current = true;
  };

  const handleBlur = () => {
    hasFocus.current = false;

    if (!localInputRef.current) {
      return;
    }

    const newValue = localInputRef.current.value;
    const isNewValueValid =
      newValue === "" ||
      !isNaN(new Date(localInputRef.current.value).getTime());

    if (isNewValueValid && field.value !== newValue) {
      field.onChange(newValue ?? "");
    }

    if (onBlurFromField) {
      onBlurFromField();
    }
  };

  const { ref, name } = field;
  const inputRef = useForkRef(ref, localInputRef);

  return (
    <FormField id={id} className={className} name={field.name}>
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
          id={id}
          ref={inputRef}
          name={name}
          defaultValue={format(initialDefaultValueRef.current)}
          key={inputKey}
          type="datetime-local"
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={clsx(
            "ra-input",
            `ra-input-${source}`,
            "scheme-light dark:scheme-dark relative [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:opacity-100 appearance-none",
            className,
          )}
          disabled={disabled || readOnly}
          readOnly={readOnly}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export type DateTimeInputProps = Omit<InputProps, "defaultValue"> & {
  defaultValue?: string | number | Date;
} & Omit<React.ComponentProps<"input">, "defaultValue" | "type">;

const leftPad =
  (nb = 2) =>
  (value: number) =>
    ("0".repeat(nb) + value).slice(-nb);
const leftPad4 = leftPad(4);
const leftPad2 = leftPad(2);

const convertDateToString = (value: Date) => {
  if (!(value instanceof Date) || isNaN(value.getDate())) return "";
  const yyyy = leftPad4(value.getFullYear());
  const MM = leftPad2(value.getMonth() + 1);
  const dd = leftPad2(value.getDate());
  const hh = leftPad2(value.getHours());
  const mm = leftPad2(value.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
};

const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const formatDateTime = (value: string | Date) => {
  if (value == null || value === "") {
    return "";
  }

  if (value instanceof Date) {
    return convertDateToString(value);
  }
  if (dateTimeRegex.test(value)) {
    return value;
  }

  return convertDateToString(new Date(value));
};

const convertDateStringToISO = (date: string) => {
  const localDate = new Date(date);
  return localDate.toISOString();
};

function useForkRef<Instance>(
  ...refs: Array<React.Ref<Instance> | undefined>
): React.RefCallback<Instance> | null {
  const cleanupRef = React.useRef<() => void>(undefined);

  const refEffect = React.useCallback((instance: Instance) => {
    const cleanups = refs.map((ref) => {
      if (ref == null) {
        return null;
      }

      if (typeof ref === "function") {
        const refCallback = ref;
        const refCleanup: void | (() => void) = refCallback(instance);
        return typeof refCleanup === "function"
          ? refCleanup
          : () => {
              refCallback(null);
            };
      }

      ref.current = instance;
      return () => {
        ref.current = null;
      };
    });

    return () => {
      cleanups.forEach((refCleanup) => refCleanup?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refs);

  return React.useMemo(() => {
    if (refs.every((ref) => ref == null)) {
      return null;
    }

    return (value) => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }

      if (value != null) {
        cleanupRef.current = refEffect(value);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refs);
}
