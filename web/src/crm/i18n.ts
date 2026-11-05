import polyglotI18nProvider from "ra-i18n-polyglot";
import { it } from "./it";

export const i18nProvider = polyglotI18nProvider(() => it, "it", [{ name: "it", value: "Italiano" }], {
  allowMissing: true,
});
