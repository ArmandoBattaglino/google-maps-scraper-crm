import type { MouseEvent } from "react";
import { useState } from "react";
import type { RaRecord, UseGetListOptions } from "ra-core";
import { Translate, useListContext } from "ra-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const SelectAllButton = <RecordType extends RaRecord = RaRecord>({
  label = "ra.action.select_all",
  limit,
  queryOptions,
  className,
  onClick,
  ...props
}: SelectAllButtonProps<RecordType>) => {
  const [isSelected, setIsSelected] = useState(false);
  const { getData, onSelect, onSelectAll } = useListContext<RecordType>();

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (getData) {
      const records = await getData({
        maxResults: limit,
        meta: queryOptions?.meta,
      });
      onSelect(records?.map((record) => record.id) ?? []);
    } else {
      onSelectAll({ limit, queryOptions });
    }
    onClick?.(event);
    setIsSelected(true);
  };

  if (isSelected) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-9", className)}
      onClick={handleClick}
      {...props}
    >
      <Translate i18nKey={label}>{label}</Translate>
    </Button>
  );
};

export type SelectAllButtonProps<RecordType extends RaRecord = RaRecord> = {
  label?: string;
  limit?: number;
  queryOptions?: UseGetListOptions<RecordType>;
} & React.ComponentPropsWithoutRef<"button">;
