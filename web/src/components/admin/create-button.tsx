import React from "react";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  LinkBase,
  useCreatePath,
  useGetResourceLabel,
  useResourceContext,
  useResourceTranslation,
} from "ra-core";
import { cn } from "@/lib/utils";

export type CreateButtonProps = {
  label?: string;
  resource?: string;
};

export const CreateButton = (props: CreateButtonProps) => {
  const { label: labelProp } = props;
  const resource = useResourceContext(props);
  const createPath = useCreatePath();
  const getResourceLabel = useGetResourceLabel();
  const link = createPath({
    resource,
    type: "create",
  });
  const label = useResourceTranslation({
    resourceI18nKey: resource
      ? `resources.${resource}.action.create`
      : undefined,
    baseI18nKey: "ra.action.create",
    options: {
      name: resource ? getResourceLabel(resource, 1) : undefined,
    },
    userText: labelProp,
  });
  return (
    <LinkBase
      className={cn(buttonVariants({ variant: "default" }))}
      to={link}
      onClick={stopPropagation}
      aria-label={typeof label === "string" ? label : undefined}
    >
      <Plus />
      {label}
    </LinkBase>
  );
};

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
