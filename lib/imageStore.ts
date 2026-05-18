// IndexedDB-backed image store.
//
// Why: the hotlist autofill / engine workflows accumulate base64
// LinkedIn screenshots that can easily be 100s of KB each. localStorage
// has a ~5 MB per-origin cap; once you have a dozen accounts each with a
// handful of prospects, you blow through it. IDB has effectively no cap
// for this app's scale.
//
// Strategy: we keep app state in localStorage as before, but image
// fields hold opaque ref strings instead of raw data URLs. Refs look
// like `idb:<uuid>` and resolve to a data URL via loadImage(). Legacy
// inline `data:` URLs are still understood transparently and migrated
// lazily.

const DB_NAME = "toptal-sdr-engine";
const STORE_NAME = "images";
const DB_VERSION = 1;
export const IDB_PREFIX = "idb:";

// In-memory cache: ref -> data URL. Populated on first load so subsequent
// re-renders of the same image (scrolling, modal open/close) hit memory
// rather than IDB.
const memCache = new Map<string, string>();

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available in this environment"));
  }
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(new Error("IndexedDB open blocked by another connection"));
  });
  // If the open fails, allow a retry on the next call.
  _dbPromise.catch(() => {
    _dbPromise = null;
  });
  return _dbPromise;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function runRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE_NAME, mode);
    let result: T | undefined;
    const req = fn(t.objectStore(STORE_NAME));
    req.onsuccess = () => {
      result = req.result;
    };
    req.onerror = () => reject(req.error);
    t.oncomplete = () => resolve(result as T);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("IDB transaction aborted"));
  });
}

export function isIdbRef(ref: string | null | undefined): boolean {
  return typeof ref === "string" && ref.startsWith(IDB_PREFIX);
}

export function isInlineDataUrl(ref: string | null | undefined): boolean {
  return typeof ref === "string" && ref.startsWith("data:");
}

// Store a data URL and return its ref string. The ref is what should land
// in app state.
export async function putImage(dataUrl: string): Promise<string> {
  const id = newId();
  await withStore("readwrite", (s) => s.put(dataUrl, id));
  const ref = `${IDB_PREFIX}${id}`;
  memCache.set(ref, dataUrl);
  return ref;
}

// Resolve a ref to a displayable data URL. Legacy inline data URLs pass
// through unchanged. Returns null if the image is missing/unreadable.
export async function loadImage(
  ref: string | null | undefined,
): Promise<string | null> {
  if (!ref) return null;
  if (isInlineDataUrl(ref)) return ref;
  if (!isIdbRef(ref)) return null;
  const cached = memCache.get(ref);
  if (cached !== undefined) return cached;
  try {
    const id = ref.slice(IDB_PREFIX.length);
    const data = await withStore<string | undefined>("readonly", (s) =>
      s.get(id),
    );
    if (typeof data === "string") {
      memCache.set(ref, data);
      return data;
    }
    return null;
  } catch (err) {
    console.warn("loadImage failed:", err);
    return null;
  }
}

// Synchronous cache lookup. Useful when you want to render immediately if
// the image was already loaded; otherwise the caller should fall back to
// loadImage().
export function peekImageFromCache(
  ref: string | null | undefined,
): string | null {
  if (!ref) return null;
  if (isInlineDataUrl(ref)) return ref;
  if (!isIdbRef(ref)) return null;
  return memCache.get(ref) ?? null;
}

// Remove an image. Safe to call with null/legacy/unknown refs (no-op).
// Fire-and-forget by callers is fine — we don't want UI to block on it.
export async function deleteImage(
  ref: string | null | undefined,
): Promise<void> {
  if (!ref || !isIdbRef(ref)) return;
  const id = ref.slice(IDB_PREFIX.length);
  memCache.delete(ref);
  try {
    await withStore("readwrite", (s) => s.delete(id));
  } catch (err) {
    // Non-fatal: orphaned entries are harmless and can be vacuumed later.
    console.warn("deleteImage failed:", err);
  }
}

// Move an inline data URL into IDB. Returns the new ref. If the input is
// already an IDB ref or null/empty, returns it unchanged. On failure,
// returns the input unchanged so the caller can keep the inline form
// rather than losing the image entirely.
export async function migrateInlineToIdb(
  ref: string | null | undefined,
): Promise<string | null> {
  if (!ref) return null;
  if (isIdbRef(ref)) return ref;
  if (!isInlineDataUrl(ref)) return ref;
  try {
    return await putImage(ref);
  } catch (err) {
    console.warn("Inline image migration failed; keeping inline:", err);
    return ref;
  }
}

// Inline an IDB ref back to a portable data URL (for export). Inline refs
// and null pass through unchanged. Returns null if the IDB entry is gone.
export async function inlineFromIdb(
  ref: string | null | undefined,
): Promise<string | null> {
  if (!ref) return null;
  if (isInlineDataUrl(ref)) return ref;
  if (!isIdbRef(ref)) return null;
  return loadImage(ref);
}

// Reset the in-memory cache. Useful for tests.
export function _resetImageCacheForTests(): void {
  memCache.clear();
}
