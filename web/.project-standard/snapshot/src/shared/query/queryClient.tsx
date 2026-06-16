import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

export function QueryProvider({
  client,
  children
}: PropsWithChildren<{ client: QueryClient }>) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
