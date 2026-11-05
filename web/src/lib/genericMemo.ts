import type { FunctionComponent } from "react";
import { memo } from "react";

export function genericMemo<T>(component: T): T {
  const result = memo(component as FunctionComponent);

  // @ts-expect-error: genericMemo does not have a displayName property
  result.displayName = component.displayName?.replace("Impl", "");
  return result as unknown as T;
}
