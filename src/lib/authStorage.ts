/**
 * Where Supabase keeps the sign-in. iPhone home-screen apps can lose localStorage, so every write is
 * mirrored into IndexedDB and restored from there when localStorage comes back empty.
 * When "Stay signed in" is off, the session lives in sessionStorage only (gone when the app closes).
 */
const DB = "lulu-auth";
const STORE = "kv";
const STAY_KEY = "lulu:staySignedIn";

export const staySignedIn = () => {
  try {
    return localStorage.getItem(STAY_KEY) !== "0";
  } catch {
    return true;
  }
};
export const setStaySignedIn = (on: boolean) => {
  try {
    localStorage.setItem(STAY_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
};

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        const tx = open.result.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      };
    } catch {
      resolve(undefined);
    }
  });
}

const safe = (fn: () => void) => {
  try {
    fn();
  } catch {
    /* storage unavailable */
  }
};

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!staySignedIn()) return sessionStorage.getItem(key);
    let v: string | null = null;
    safe(() => (v = localStorage.getItem(key)));
    if (v !== null) return v;
    const backup = (await idb<string>("readonly", (s) => s.get(key) as IDBRequest<string>)) ?? null;
    if (backup !== null) safe(() => localStorage.setItem(key, backup));
    return backup;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!staySignedIn()) return safe(() => sessionStorage.setItem(key, value));
    safe(() => localStorage.setItem(key, value));
    await idb("readwrite", (s) => s.put(value, key));
  },
  async removeItem(key: string): Promise<void> {
    safe(() => localStorage.removeItem(key));
    safe(() => sessionStorage.removeItem(key));
    await idb("readwrite", (s) => s.delete(key));
  },
};
