import type { ReactElement, ReactNode } from "react";
import { memo } from "react";
import type {
  FilterPayload,
  ListControllerResult,
  RaRecord,
  SortPayload,
  ExtractRecordPaths,
  HintedString,
} from "ra-core";
import { ReferenceArrayFieldBase, useListContext } from "ra-core";
import type { UseQueryOptions } from "@tanstack/react-query";
import { SingleFieldList } from "@/components/admin/single-field-list";

export const ReferenceArrayField = <
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: ReferenceArrayFieldProps<RecordType, ReferenceRecordType>,
) => {
  const {
    filter,
    page = 1,
    perPage,
    reference,
    resource,
    sort,
    source,
    queryOptions,
    render,
    ...rest
  } = props;
  return (
    <ReferenceArrayFieldBase
      filter={filter}
      page={page}
      perPage={perPage}
      reference={reference}
      resource={resource}
      sort={sort}
      source={source}
      queryOptions={queryOptions}
      render={render}
    >
      <PureReferenceArrayFieldView {...rest} />
    </ReferenceArrayFieldBase>
  );
};
export interface ReferenceArrayFieldProps<
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
> extends ReferenceArrayFieldViewProps {
  filter?: FilterPayload;
  page?: number;
  pagination?: ReactElement;
  perPage?: number;
  reference: string;
  resource?: string;
  source: NoInfer<HintedString<ExtractRecordPaths<RecordType>>>;
  sort?: SortPayload;
  queryOptions?: Omit<
    UseQueryOptions<ReferenceRecordType[], Error>,
    "queryFn" | "queryKey"
  >;
  render?: (props: ListControllerResult<ReferenceRecordType>) => ReactElement;
}

export interface ReferenceArrayFieldViewProps {
  children?: ReactNode;
  className?: string;
  empty?: ReactNode;
  error?: ReactNode;
  loading?: ReactNode;
  pagination?: ReactNode;
}

export const ReferenceArrayFieldView = (
  props: ReferenceArrayFieldViewProps,
) => {
  const {
    children = defaultChildren,
    className,
    empty,
    error: errorElement,
    loading,
    pagination,
  } = props;
  const {
    isPending,
    error,
    total,
    hasPreviousPage,
    hasNextPage,
    data,
    filterValues,
  } = useListContext();

  return (
    <div className={className}>
      {isPending && loading !== false ? (
        loading
      ) : error && errorElement !== false ? (
        errorElement
      ) : (total === 0 ||
          (total == null &&
            hasPreviousPage === false &&
            hasNextPage === false &&
            // @ts-expect-error FIXME total may be undefined when using partial pagination but the ListControllerResult type is wrong about it
            data.length === 0 &&
            !Object.keys(filterValues).length)) &&
        empty !== false ? (
        empty
      ) : (
        <span>
          {children}
          {pagination && total !== undefined ? pagination : null}
        </span>
      )}
    </div>
  );
};

const defaultChildren = <SingleFieldList />;
const PureReferenceArrayFieldView = memo(ReferenceArrayFieldView);
