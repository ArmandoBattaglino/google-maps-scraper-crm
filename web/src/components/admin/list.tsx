import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin/breadcrumb";
import type { ListBaseProps, ListControllerResult, RaRecord } from "ra-core";
import {
  FilterContext,
  LinkBase,
  ListBase,
  Translate,
  useGetResourceLabel,
  useHasDashboard,
  useListContext,
  useResourceContext,
  useResourceDefinition,
  useTranslate,
} from "ra-core";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CreateButton } from "@/components/admin/create-button";
import { ListPagination } from "@/components/admin/list-pagination";
import { FilterButton, FilterForm } from "@/components/admin/filter-form";
import { Testata } from "@/layout/Testata";

export const List = <RecordType extends RaRecord = RaRecord>(
  props: ListProps<RecordType>,
) => {
  const {
    debounce,
    disableAuthentication,
    disableSyncWithLocation,
    exporter,
    filter,
    filterDefaultValues,
    loading,
    perPage,
    queryOptions,
    resource,
    sort,
    storeKey,
    ...rest
  } = props;

  return (
    <ListBase<RecordType>
      debounce={debounce}
      disableAuthentication={disableAuthentication}
      disableSyncWithLocation={disableSyncWithLocation}
      exporter={exporter}
      filter={filter}
      filterDefaultValues={filterDefaultValues}
      loading={loading}
      perPage={perPage}
      queryOptions={queryOptions}
      resource={resource}
      sort={sort}
      storeKey={storeKey}
    >
      <ListView<RecordType> {...rest} />
    </ListBase>
  );
};

export interface ListProps<RecordType extends RaRecord = RaRecord>
  extends ListBaseProps<RecordType>, ListViewProps<RecordType> {}

export const ListView = <RecordType extends RaRecord = RaRecord>(
  props: ListViewProps<RecordType>,
) => {
  const {
    disableBreadcrumb,
    filters,
    pagination = defaultPagination,
    title,
    children,
    actions,
  } = props;
  const translate = useTranslate();
  const resource = useResourceContext();
  const { total } = useListContext();
  if (!resource) {
    throw new Error(
      "The ListView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const resourceLabel = getResourceLabel(resource, 2);
  const finalTitle =
    title !== undefined
      ? title
      : translate("ra.page.list", {
          name: resourceLabel,
        });
  const { hasCreate } = useResourceDefinition({ resource });
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
          <BreadcrumbPage>{resourceLabel}</BreadcrumbPage>
        </Breadcrumb>
      )}

      <FilterContext.Provider value={filters}>
        <Testata
          titolo={finalTitle}
          conteggio={total != null && total >= 0 ? total.toLocaleString("it-IT") : undefined}
          azioni={
            actions ?? (
              <>
                {filters && filters.length > 1 ? <FilterButton /> : null}
                {hasCreate ? <CreateButton /> : null}
              </>
            )
          }
        />
        {}
        <div className="px-6 pb-2.5 [&_form]:m-0 [&_form]:flex-1">
          <FilterForm />
        </div>

        <div className={cn("pr-4 pl-5", props.className)}>{children}</div>
        <div className="px-6 pt-3 pb-6">{pagination}</div>
      </FilterContext.Provider>
    </>
  );
};

const defaultPagination = <ListPagination />;

export const Empty = () => {
  const translate = useTranslate();
  const resource = useResourceContext();
  const getResourceLabel = useGetResourceLabel();
  const { hasCreate } = useResourceDefinition({ resource });
  if (!resource) {
    return null;
  }
  const resourceName = translate(`resources.${resource}.forcedCaseName`, {
    smart_count: 0,
    _: resource ? getResourceLabel(resource, 0) : undefined,
  });
  const emptyMessage = translate("ra.page.empty", { name: resourceName });
  const inviteMessage = translate("ra.page.invite");

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <h2 className="text-titolo font-semibold text-ink">
        {translate(`resources.${resource}.empty`, {
          _: emptyMessage,
        })}
      </h2>
      {hasCreate ? (
        <>
          <p className="text-muted-foreground">
            {translate(`resources.${resource}.invite`, {
              _: inviteMessage,
            })}
          </p>
          <CreateButton />
        </>
      ) : null}
    </div>
  );
};

export interface ListViewProps<RecordType extends RaRecord = RaRecord> {
  children?: ReactNode;
  disableBreadcrumb?: boolean;
  render?: (props: ListControllerResult<RecordType, Error>) => ReactNode;
  actions?: ReactElement | false;
  filters?: ReactNode[];
  pagination?: ReactNode;
  title?: ReactNode | string | false;
  className?: string;
}
