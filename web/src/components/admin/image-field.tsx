/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HTMLAttributes } from "react";
import get from "lodash/get.js";
import type { ExtractRecordPaths, HintedString } from "ra-core";
import { useFieldValue, useTranslate } from "ra-core";
import { cn } from "@/lib/utils";

import type { FieldProps } from "@/lib/field.type";

export const ImageField = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  props: ImageFieldProps<RecordType>,
) => {
  const { src, defaultValue, source, record, empty, title, ...rest } = props;
  const value = useFieldValue({ defaultValue, source, record });
  const titleValue =
    useFieldValue({
      ...props,
      // @ts-expect-error We ignore here because title might be a custom label or undefined instead of a field name
      source: title,
    })?.toString() ?? title;
  const translate = useTranslate();

  if (value == null) {
    if (!empty) {
      return null;
    }
    return (
      <span {...rest} className={cn("image-empty", rest.className)}>
        {typeof empty === "string" ? translate(empty, { _: empty }) : empty}
      </span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <span {...rest} className={cn("image-list", rest.className)}>
        <ul>
          {value.map((file, index) => {
            const fileTitleValue = title ? get(file, title, title) : title;
            const srcValue = src ? get(file, src, title) : title;

            return (
              <li key={index}>
                <img
                  alt={fileTitleValue}
                  title={fileTitleValue}
                  src={srcValue}
                />
              </li>
            );
          })}
        </ul>
      </span>
    );
  }

  return (
    <span {...rest} className={cn("image-single", rest.className)}>
      <img title={titleValue} alt={titleValue} src={value?.toString()} />
    </span>
  );
};

ImageField.displayName = "ImageField";

export interface ImageFieldProps<
  RecordType extends Record<string, any> = Record<string, any>,
>
  extends FieldProps<RecordType>, HTMLAttributes<HTMLSpanElement> {
  defaultValue?: any;
  src?: string;
  title?: HintedString<ExtractRecordPaths<RecordType>>;
}
