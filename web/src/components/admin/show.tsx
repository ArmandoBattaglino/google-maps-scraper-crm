import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin/breadcrumb";
import type { ShowBaseProps } from "ra-core";
import {
  LinkBase,
  ShowBase,
  Translate,
  useCreatePath,
  useHasDashboard,
  useShowContext,
  useGetRecordRepresentation,
  useGetResourceLabel,
  useResourceContext,
  useResourceDefinition,
} from "ra-core";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EditButton } from "@/components/admin/edit-button";

export interface ShowProps
  extends ShowViewProps, Omit<ShowBaseProps, "children"> {}

export const Show = ({
  actions,
  children,
  className,
  disableAuthentication,
  disableBreadcrumb,
  id,
  loading,
  queryOptions,
  render,
  resource,
  title,
}: ShowProps) => (
  <ShowBase
    id={id}
    resource={resource}
    queryOptions={queryOptions}
    disableAuthentication={disableAuthentication}
    render={render}
    loading={loading}
  >
    <ShowView
      title={title}
      actions={actions}
      className={className}
      disableBreadcrumb={disableBreadcrumb}
    >
      {children}
    </ShowView>
  </ShowBase>
);

export interface ShowViewProps {
  actions?: ReactNode;
  disableBreadcrumb?: boolean;
  children: ReactNode;
  className?: string;
  emptyWhileLoading?: boolean;
  title?: ReactNode | string | false;
}

export const ShowView = ({
  actions,
  children,
  className,
  disableBreadcrumb,
  emptyWhileLoading,
  title,
}: ShowViewProps) => {
  const context = useShowContext();

  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The ShowView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const listLabel = getResourceLabel(resource, 2);
  const createPath = useCreatePath();
  const listLink = createPath({
    resource,
    type: "list",
  });

  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const recordRepresentation = getRecordRepresentation(context.record);

  const { hasEdit } = useResourceDefinition({ resource });
  const hasDashboard = useHasDashboard();

  if (context.isLoading || !context.record) {
    return null;
  }
  if (!context.record && emptyWhileLoading) {
    return null;
  }

  return (
    <>
      {!disableBreadcrumb && (
        <Breadcrumb>
          {hasDashboard && (
            <BreadcrumbItem>
              <LinkBase to="/">
                <Translate i18nKey="ra.page.dashboard">Home</Translate>
              </LinkBase>
            </BreadcrumbItem>
          )}
          <BreadcrumbItem>
            <LinkBase to={listLink}>{listLabel}</LinkBase>
          </BreadcrumbItem>
          <BreadcrumbPage>{recordRepresentation}</BreadcrumbPage>
        </Breadcrumb>
      )}
      <div
        className={cn(
          "flex justify-between items-center flex-wrap gap-3 px-6 pt-[18px] pb-3",
          className,
        )}
      >
        <h1 className="text-titolo font-semibold tracking-[-0.01em] text-ink">
          {title !== undefined ? title : context.defaultTitle}
        </h1>
        {actions ?? (
          <div className="flex justify-end items-center">
            {hasEdit ? <EditButton /> : null}
          </div>
        )}
      </div>
      <div className="px-6 pb-10">{children}</div>
    </>
  );
};
