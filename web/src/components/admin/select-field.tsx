import type { HTMLAttributes } from "react";
import type { ChoicesProps } from "ra-core";
import { genericMemo, useChoices, useFieldValue, useTranslate } from "ra-core";

import type { FieldProps } from "@/lib/field.type";

const SelectFieldImpl = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
>(
  props: SelectFieldProps<RecordType>,
) => {
  const {
    className,
    empty,
    choices,
    defaultValue,
    source,
    record,
    optionValue = "id",
    optionText = "name",
    translateChoice = true,
    ...rest
  } = props;
  const value = useFieldValue({ defaultValue, source, record });

  const { getChoiceText, getChoiceValue } = useChoices({
    optionText,
    optionValue,
    translateChoice,
  });
  const translate = useTranslate();

  const choice = choices
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      choices.find((choice: any) => getChoiceValue(choice) === value)
    : null;

  if (!choice) {
    if (!empty) {
      return null;
    }

    return (
      <span className={className} {...rest}>
        {typeof empty === "string" ? translate(empty, { _: empty }) : empty}
      </span>
    );
  }

  const choiceText = getChoiceText(choice);

  return (
    <span className={className} {...rest}>
      {choiceText}
    </span>
  );
};

SelectFieldImpl.displayName = "SelectFieldImpl";

export const SelectField = genericMemo(SelectFieldImpl);

export interface SelectFieldProps<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
>
  extends
    Omit<ChoicesProps, "disableValue" | "createValue" | "createHintValue">,
    FieldProps<RecordType>,
    HTMLAttributes<HTMLSpanElement> {}
