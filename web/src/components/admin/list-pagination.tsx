import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useListPaginationContext, Translate, useTranslate } from "ra-core";

const conPunti = (n: number | undefined) => (n ?? 0).toLocaleString("it-IT");

export const ListPagination = ({
  rowsPerPageOptions = [25, 50, 100],
  className,
}: {
  rowsPerPageOptions?: number[];
  className?: string;
}) => {
  const translate = useTranslate();
  const {
    hasPreviousPage,
    hasNextPage,
    page,
    perPage,
    setPerPage,
    total,
    setPage,
  } = useListPaginationContext();

  const pageStart = (page - 1) * perPage + 1;
  const pageEnd = hasNextPage ? page * perPage : total;

  const boundaryCount = 1;
  const siblingCount = 1;
  const count = total ? Math.ceil(total / perPage) : 1;

  const range = (start: number, end: number) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, i) => start + i);
  };

  const startPages = range(1, Math.min(boundaryCount, count));
  const endPages = range(
    Math.max(count - boundaryCount + 1, boundaryCount + 1),
    count,
  );

  const siblingsStart = Math.max(
    Math.min(
      page - siblingCount,
      count - boundaryCount - siblingCount * 2 - 1,
    ),
    boundaryCount + 2,
  );

  const siblingsEnd = Math.min(
    Math.max(
      page + siblingCount,
      boundaryCount + siblingCount * 2 + 2,
    ),
    count - boundaryCount - 1,
  );

  const siblingPages = range(siblingsStart, siblingsEnd);

  const pageChangeHandler = (newPage: number) => {
    return (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      setPage(newPage);
    };
  };

  if (!total) return null;

  return (
    <div
      className={cn("flex items-center justify-end gap-4 text-ink2", className)}
    >
      <div className="hidden md:flex items-center space-x-2">
        <p className="text-xs text-mute">
          <Translate i18nKey="ra.navigation.page_rows_per_page">
            Rows per page
          </Translate>
        </p>
        <Select
          value={perPage.toString()}
          onValueChange={(value) => {
            setPerPage(Number(value));
          }}
        >
          <SelectTrigger size="sm" className="w-fit">
            <SelectValue placeholder={perPage} />
          </SelectTrigger>
          <SelectContent side="top" alignItemWithTrigger={false}>
            {rowsPerPageOptions.map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="text-xs text-mute tabular-nums">
        <Translate
          i18nKey="ra.navigation.page_range_info"
          options={{
            offsetBegin: conPunti(pageStart),
            offsetEnd: conPunti(pageEnd),
            total: conPunti(total === -1 ? pageEnd : total),
          }}
        >
          {total != null
            ? `${pageStart}-${pageEnd} of ${total === -1 ? pageEnd : total}`
            : null}
        </Translate>
      </div>
      <Pagination className="-w-full -mx-auto">
        <PaginationContent>
          <PaginationItem>
            {hasPreviousPage ? (
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(page - 1)}
                aria-label={translate("ra.navigation.previous", {
                  _: "Previous",
                })}
              >
                <ChevronLeftIcon />
              </PaginationLink>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium size-[30px]">
                <ChevronLeftIcon
                  aria-label={translate("ra.navigation.previous", {
                    _: "Previous",
                  })}
                  size="16"
                  className="text-mute-deco"
                />
              </span>
            )}
          </PaginationItem>
          {startPages.map((pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(pageNumber)}
                isActive={pageNumber === page}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ))}
          {siblingsStart > boundaryCount + 2 ? (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          ) : boundaryCount + 1 < count - boundaryCount ? (
            <PaginationItem>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(boundaryCount + 1)}
                isActive={boundaryCount + 1 === page}
              >
                {boundaryCount + 1}
              </PaginationLink>
            </PaginationItem>
          ) : null}
          {siblingPages.map((pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(pageNumber)}
                isActive={pageNumber === page}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ))}
          {siblingsEnd < count - boundaryCount - 1 ? (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          ) : count - boundaryCount > boundaryCount ? (
            <PaginationItem>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(count - boundaryCount)}
                isActive={count - boundaryCount === page}
              >
                {count - boundaryCount}
              </PaginationLink>
            </PaginationItem>
          ) : null}
          {endPages.map((pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(pageNumber)}
                isActive={pageNumber === page}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            {hasNextPage ? (
              <PaginationLink
                href="#"
                onClick={pageChangeHandler(page + 1)}
                size="default"
                className={cn(
                  "gap-1 px-2.5 sm:pr-2.5",
                  !hasNextPage ? "opacity-50 cursor-not-allowed" : "",
                )}
                aria-label={translate("ra.navigation.next", { _: "Next" })}
              >
                <ChevronRightIcon />
              </PaginationLink>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium size-[30px]">
                <ChevronRightIcon
                  aria-label={translate("ra.navigation.next", { _: "Next" })}
                  size="16"
                  className="text-mute-deco"
                />
              </span>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};
