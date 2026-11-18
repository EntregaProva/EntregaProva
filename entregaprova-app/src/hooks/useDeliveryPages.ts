import { useCallback, useState } from "react";
import { listDeliveries, type DeliveryStatus } from "../api/deliveries.ts";
import { useAsyncData } from "./useAsyncData.ts";

export function useDeliveryPages(status?: DeliveryStatus) {
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const cursor = cursors[cursors.length - 1];
  const load = useCallback(async () => ({ cursor, ...await listDeliveries(cursor, status) }), [cursor, status]);
  const { data, error, loading, reload } = useAsyncData(load);
  const page = data?.cursor === cursor ? data : null;
  const nextCursor = page?.nextCursor;

  return {
    data: page?.items ?? null,
    error,
    loading: loading || (!error && !page),
    reload,
    firstPage() {
      setCursors([null]);
      reload();
    },
    pagination: {
      page: cursors.length,
      previous: cursors.length > 1 ? () => setCursors(current => current === cursors ? current.slice(0, -1) : current) : undefined,
      next: nextCursor ? () => setCursors(current => current === cursors ? [...current, nextCursor] : current) : undefined,
    },
  };
}
