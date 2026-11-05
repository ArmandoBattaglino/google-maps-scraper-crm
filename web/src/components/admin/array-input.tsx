import * as React from "react";
import type { InputProps } from "ra-core";
import {
  FieldTitle,
  isRequired,
  useSourceContext,
  sanitizeInputRestProps,
  ArrayInputBase,
} from "ra-core";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { FormError, FormField } from "@/components/admin/form";

export const ArrayInput = (props: ArrayInputProps) => {
  const {
    className,
    defaultValue = [],
    label,
    isPending,
    children,
    helperText,
    resource: resourceFromProps,
    source: arraySource,
    validate,
    ...rest
  } = props;

  const parentSourceContext = useSourceContext();
  const finalSource = parentSourceContext.getSource(arraySource);

  const labelId = React.useId();

  if (isPending) {
    return <Skeleton className="w-full h-9" />;
  }

  return (
    <FormField
      className={cn(
        "ra-input",
        `ra-input-${finalSource}`,
        className,
        "w-full flex flex-col gap-2",
      )}
      aria-labelledby={labelId}
      role="group"
      name={finalSource}
      {...sanitizeInputRestProps(rest)}
    >
      <Label className="text-muted-foreground text-sm" id={labelId}>
        <FieldTitle
          label={label}
          source={arraySource}
          resource={resourceFromProps}
          isRequired={isRequired(validate)}
        />
      </Label>
      <ArrayInputBase {...props} defaultValue={defaultValue}>
        {children}
      </ArrayInputBase>

      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export interface ArrayInputProps extends Omit<
  InputProps,
  "disabled" | "readOnly"
> {
  className?: string;
  children: React.ReactNode;
  isFetching?: boolean;
  isLoading?: boolean;
  isPending?: boolean;
}
