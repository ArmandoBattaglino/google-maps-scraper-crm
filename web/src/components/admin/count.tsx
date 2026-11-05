import type { SortPayload } from "ra-core";
import {
  LinkBase,
  useResourceContext,
  useGetList,
  useTimeout,
  useCreatePath,
} from "ra-core";
import { CircleX, LoaderCircle } from "lucide-react";

export const Count = (props: CountProps) => {
  const {
    filter,
    sort,
    link,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resource: resourceFromProps,
    timeout = 1000,
    ...rest
  } = props;
  const resource = useResourceContext(props);
  if (!resource) {
    throw new Error(
      "The Count component must be used inside a ResourceContext or must be passed a resource prop.",
    );
  }
  const oneSecondHasPassed = useTimeout(timeout);
  const createPath = useCreatePath();

  const { total, isPending, error } = useGetList(resource, {
    filter,
    sort,
    pagination: { perPage: 1, page: 1 },
  });

  const body = isPending ? (
    oneSecondHasPassed ? (
      <LoaderCircle className="animate-spin" />
    ) : (
      ""
    )
  ) : error ? (
    <CircleX color="error" />
  ) : (
    total
  );

  return link ? (
    <LinkBase
      to={{
        pathname: createPath({ resource, type: "list" }),
        search: filter ? `filter=${JSON.stringify(filter)}` : undefined,
      }}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
      {...rest}
    >
      {body}
    </LinkBase>
  ) : (
    <span {...rest}>{body}</span>
  );
};

export interface CountProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: any;
  sort?: SortPayload;
  link?: boolean;
  resource?: string;
  timeout?: number;
}
