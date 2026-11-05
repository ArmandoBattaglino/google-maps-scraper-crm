import { createContext, useContext } from "react";

export type UserMenuContextValue = {
  onClose: () => void;
};

export const UserMenuContext = createContext<UserMenuContextValue | undefined>(
  undefined,
);

export const useUserMenu = () => useContext(UserMenuContext);
