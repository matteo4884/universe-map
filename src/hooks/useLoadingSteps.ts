import { useSyncExternalStore } from "react";
import { loadingStore, type LoadStep } from "../helper/loadingStore";

/** The startup steps done so far (helper/loadingStore.ts) */
export function useLoadingSteps(): ReadonlySet<LoadStep> {
  return useSyncExternalStore(loadingStore.subscribe, loadingStore.done);
}
