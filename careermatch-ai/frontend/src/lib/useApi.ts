import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "./api";

/** Loads a GET endpoint with loading + error state and a reload function. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!path) return;
    const id = ++seq.current;
    if (!silent) setLoading(true);
    setError(null);
    try { const d = await api.get<T>(path); if (id === seq.current) setData(d); }
    catch (e) { if (id === seq.current) setError(errMsg(e)); }
    finally { if (id === seq.current) setLoading(false); }
  }, [path]);

  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: () => load(true), setData };
}
