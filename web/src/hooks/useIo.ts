import { useQuery } from "@tanstack/react-query";
import { leggiIo, type Io } from "@/providers/accesso";

export const CHIAVE_IO = ["crm", "io"] as const;

export const useIo = () =>
  useQuery<Io>({
    queryKey: CHIAVE_IO,
    queryFn: leggiIo,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
