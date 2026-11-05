import { CircleX } from "lucide-react";
import { Translate, useNavigate } from "ra-core";

import { Button } from "../ui/button";

export function CancelButton(props: React.ComponentProps<"button">) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => navigate(-1)}
      className="cursor-pointer"
      {...props}
    >
      <CircleX />
      <Translate i18nKey="ra.action.cancel">Cancel</Translate>
    </Button>
  );
}
