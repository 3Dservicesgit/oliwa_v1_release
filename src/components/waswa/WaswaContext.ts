/**
 * WaswaContext — one Waswa for the whole OLIWA tracking console.
 *
 * WaswaProvider (WaswaProvider.tsx) mounts a single chat drawer and launcher
 * for every page. Anything that should talk to Waswa — an "Ask Waswa" box, a
 * suggestion chip, a status pill, a page's ON/OFF toggle — calls useWaswa()
 * instead of keeping its own drawer, so every module shares the same
 * conversation and the same ON/OFF switch.
 *
 * Kept free of components so React fast refresh works (see WaswaProvider.tsx).
 */
import { createContext, useContext } from "react";

export interface WaswaApi {
  /** Waswa switched on for this browser (remembered). */
  on: boolean;
  setOn: (on: boolean) => void;
  toggle: () => void;
  /** The drawer is showing. */
  isOpen: boolean;
  /** Open the drawer; with a prompt, ask it straight away. */
  open: (prompt?: string) => void;
  close: () => void;
  /** The console screen the user is on, sent to Waswa as context. */
  moduleName: string | null;
}

const noop = () => {};

export const WaswaContext = createContext<WaswaApi | null>(null);

/** Safe outside the provider (does nothing), so a component never crashes. */
export function useWaswa(): WaswaApi {
  return useContext(WaswaContext) ?? {
    on: true, setOn: noop, toggle: noop, isOpen: false, open: noop, close: noop, moduleName: null,
  };
}
