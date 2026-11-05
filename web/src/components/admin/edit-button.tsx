import React from "react";
import { buttonVariants } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { RaRecord } from "ra-core";
import {
  LinkBase,
  useCreatePath,
  useGetRecordRepresentation,
  useGetResourceLabel,
  useRecordContext,
  useResourceContext,
  useResourceTranslation,
} from "ra-core";
import { cn } from "@/lib/utils";

export type EditButtonProps = {
  record?: RaRecord;
  resource?: string;
  label?: string;
};

export const EditButton = (props: EditButtonProps) => {
  const { label: labelProp } = props;
  const resource = useResourceContext(props);
  const record = useRecordContext(props);
  const createPath = useCreatePath();
  const getResourceLabel = useGetResourceLabel();
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const recordRepresentationValue = getRecordRepresentation(record);
  const recordRepresentation =
    typeof recordRepresentationValue === "string"
      ? recordRepresentationValue
      : recordRepresentationValue?.toString();
  const link = createPath({
    resource,
    type: "edit",
    id: record?.id,
  });
  const label = useResourceTranslation({
    resourceI18nKey: resource ? `resources.${resource}.action.edit` : undefined,
    baseI18nKey: "ra.action.edit",
    options: {
      name: resource ? getResourceLabel(resource, 1) : undefined,
      recordRepresentation,
    },
    userText: labelProp,
  });
  return (
    <LinkBase
      className={cn(buttonVariants({ variant: "outline" }))}
      to={link}
      onClick={stopPropagation}
      aria-label={typeof label === "string" ? label : undefined}
    >
      <Pencil />
      {label}
    </LinkBase>
  );
};

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
