import { useSyncExternalStore } from "react";
import type { PendingReview } from "@/types/api";

const STORAGE_KEY = "identityshield.pendingReviews";
const listeners = new Set<() => void>();
let cache: PendingReview[] | null = null;

function load(): PendingReview[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as PendingReview[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function persist(items: PendingReview[]) {
  cache = items;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  emit();
}

export function addPendingReview(item: PendingReview) {
  const current = load().filter(
    (entry) => entry.analysisId !== item.analysisId,
  );
  persist([item, ...current].slice(0, 30));
}

export function removePendingReview(analysisId: string) {
  persist(load().filter((entry) => entry.analysisId !== analysisId));
}

export function getPendingReviews(): PendingReview[] {
  return load();
}

export function clearPendingReviews() {
  persist([]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingReviews(): PendingReview[] {
  return useSyncExternalStore(subscribe, getPendingReviews, () => []);
}
