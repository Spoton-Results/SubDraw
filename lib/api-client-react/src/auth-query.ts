import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useGetMe as useGeneratedGetMe, getGetMeQueryKey, getMe } from "./generated/api";
import type { ErrorResponse } from "./generated/api.schemas";
import type { ErrorType } from "./custom-fetch";

type CurrentUser = Awaited<ReturnType<typeof getMe>>;
export function useGetMe<TData = CurrentUser, TError = ErrorType<ErrorResponse>>(options?: {
  query?: Omit<UseQueryOptions<CurrentUser, TError, TData>, "queryKey"> & { queryKey?: QueryKey };
  request?: Parameters<typeof getMe>[0];
}) {
  return useGeneratedGetMe<TData, TError>({
    ...options,
    query: { ...options?.query, queryKey: options?.query?.queryKey ?? getGetMeQueryKey() },
  });
}
