import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { NavProps } from "@/shared/components/Nav/Nav";

export interface HeaderNavContextValue {
  navProps: NavProps | null;
  setNavProps: Dispatch<SetStateAction<NavProps | null>>;
}

export const HeaderNavContext = createContext<HeaderNavContextValue | null>(null);

export function useHeaderNav() {
  const context = useContext(HeaderNavContext);
  if (!context) {
    throw new Error("useHeaderNav must be used within HeaderNavProvider");
  }
  return context;
}
