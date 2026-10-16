import { useEffect } from "react";

/** Runs `fn` now and every `ms` while the tab is visible, and again when the
 *  tab comes back. Pass a memoised `fn` (useCallback): a new one restarts it. */
export function usePolling(fn: () => void | Promise<void>, ms: number) {
  useEffect(() => {
    let alive = true;
    const run = () => { if (alive && !document.hidden) void fn(); };
    run();
    const t = window.setInterval(run, ms);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [fn, ms]);
}
