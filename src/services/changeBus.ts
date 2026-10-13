/**
 * Tiny event bus: storage layers announce "user data changed" so auto cloud sync can react,
 * without importing the sync service (avoids circular imports).
 */
type Listener = (username: string) => void;

const listeners = new Set<Listener>();
let suppressDepth = 0;

export const ChangeBus = {
  emit(username: string): void {
    if (suppressDepth > 0) return;
    listeners.forEach((l) => l(username.trim().toLowerCase()));
  },
  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Runs `fn` without emitting change events (e.g. while applying data pulled from the cloud). */
  async silently<T>(fn: () => Promise<T>): Promise<T> {
    suppressDepth++;
    try {
      return await fn();
    } finally {
      suppressDepth--;
    }
  },
};
