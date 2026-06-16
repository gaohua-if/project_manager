import { useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import type { NavProps } from "@/shared/components/Nav/Nav";

import { HeaderNavContext } from "./headerNavContext";

export function HeaderNavProvider({ children }: PropsWithChildren) {
  const [navProps, setNavProps] = useState<NavProps | null>(null);
  const value = useMemo(() => ({ navProps, setNavProps }), [navProps]);

  return <HeaderNavContext.Provider value={value}>{children}</HeaderNavContext.Provider>;
}
