import { useEffect } from "react";

/** Runs `fn` now and every `ms` while the tab is visible, and again when the
 *  tab comes back. Pass a memoised `fn` (useCallback): a new one restarts it.
 *
 *  A run is skipped while the previous one is still going. The hooks drop any
 *  answer older than their latest request, so a call slower than `ms` (the
 *  fleet summary took 43 s from a development machine) was superseded every
 *  time and the fleet status never appeared. */
export function usePolling(fn: () => void | Promise<void>, ms: number) {
  useEffect(() => {
    let alive = true;
    let running = false;
    const run = () => {
      if (!alive || document.hidden || running) return;
      running = true;
      void Promise.resolve()
        .then(fn)
        .catch(() => {})
        .finally(() => { running = false; });
    };
    run();
    const t = window.setInterval(run, ms);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [fn, ms]);
}
