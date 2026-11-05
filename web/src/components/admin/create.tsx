import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin/breadcrumb";
import type { CreateBaseProps } from "ra-core";
import {
  LinkBase,
  CreateBase,
  Translate,
  useCreateContext,
  useCreatePath,
  useGetResourceLabel,
  useHasDashboard,
  useResourceContext,
} from "ra-core";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CreateProps = CreateViewProps & CreateBaseProps;

export const Create = ({
  actions,
  children,
  className,
  disableBreadcrumb,
  title,
  ...rest
}: CreateProps) => (
  <CreateBase {...rest}>
    <CreateView
      actions={actions}
      className={className}
      disableBreadcrumb={disableBreadcrumb}
      title={title}
    >
      {children}
    </CreateView>
  </CreateBase>
);

export type CreateViewProps = {
  actions?: ReactNode;
  disableBreadcrumb?: boolean;
  children: ReactNode;
  className?: string;
  title?: ReactNode | string | false;
};

export const CreateView = ({
  actions,
  disableBreadcrumb,
  title,
  children,
  className,
}: CreateViewProps) => {
  const context = useCreateContext();

  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The CreateView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const listLabel = getResourceLabel(resource, 2);
  const createPath = useCreatePath();
  const listLink = createPath({
    resource,
    type: "list",
  });
  const hasDashboard = useHasDashboard();

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
          <BreadcrumbPage>
            <Translate i18nKey="ra.action.create">Create</Translate>
          </BreadcrumbPage>
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
        {actions}
      </div>
      <div className="px-6 pb-10">{children}</div>
    </>
  );
};
