import { useCallback } from "react";
import { useTranslate } from "ra-core";
import { useWatch, useFormContext } from "react-hook-form";
import { Search, X } from "lucide-react";
import type { TextInputProps } from "@/components/admin/text-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const SearchInput = (inProps: SearchInputProps) => {
  const { label, className, disableClearable, source = "q", ...rest } = inProps;

  const translate = useTranslate();
  const { setValue } = useFormContext();
  const fieldValue = useWatch({ name: source });
  const hasValue = fieldValue && fieldValue !== "";

  const handleClear = useCallback(() => {
    setValue(source, "", { shouldDirty: true });
  }, [setValue, source]);

  if (label) {
    throw new Error(
      "<SearchInput> isn't designed to be used with a label prop. Use <TextInput> if you need a label.",
    );
  }

  const showClearButton = !disableClearable && hasValue;

  return (
    <div className="flex flex-grow relative mt-auto">
      <TextInput
        source={source}
        label={false}
        helperText={false}
        placeholder={translate("ra.action.search")}
        className={cn("flex-grow", className)}
        inputClassName={cn("pr-8", showClearButton ? "pr-16" : "pr-8")}
        {...rest}
      />
      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      {showClearButton && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-8 top-1/2 transform -translate-y-1/2 h-6 w-6 rounded-full p-0 text-muted-foreground"
          aria-label={translate("ra.action.clear_search", {
            _: "Clear search",
          })}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

export type SearchInputProps = TextInputProps & {
  disableClearable?: boolean;
};
