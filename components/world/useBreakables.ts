import { useSyncExternalStore } from "react";
import { brokenProps, subscribeBreakables } from "@/lib/world/breakables";

/** The set of broken prop keys (see `breakKey`); a new set whenever something breaks or is rebuilt. */
export function useBrokenProps() {
  return useSyncExternalStore(subscribeBreakables, brokenProps, brokenProps);
}
