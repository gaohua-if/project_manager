import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    },
    mutations: {
      retry: false
    }
  }
});
