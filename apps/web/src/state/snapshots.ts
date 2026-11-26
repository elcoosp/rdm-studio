/**
 * IndexedDB named snapshots + crash recovery (v2.0.0): the serialized
 * project is stored per named snapshot and also mirrored into a
 * `__last_session` slot that the app restores after a crash.
 */

const DB_NAME = "rdm-studio-snapshots";
const STORE = "snapshots";

interface SnapshotRecord {
  name: string;
  createdAt: number;
  projectJson: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "name" });
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
    tx.oncomplete = () => {
      void db.close();
    };
  });
}

/** Typed read wrapper for value requests (get/getAll). */
async function withValue<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
    tx.oncomplete = () => {
      void db.close();
    };
  });
}

/** Persists a named snapshot (SI-serialized project JSON). */
export async function saveSnapshot(name: string, project: unknown): Promise<void> {
  const record: SnapshotRecord = {
    name,
    createdAt: Date.now(),
    projectJson: JSON.stringify(project),
  };
  await withStore("readwrite", (store) => store.put(record));
}

/** Mirrors the live project for crash recovery. */
export async function saveCrashRecovery(project: unknown): Promise<void> {
  await saveSnapshot("__last_session", project);
}

/** Returns the crash-recovery payload when one exists. */
export async function loadCrashRecovery(): Promise<unknown | null> {
  const raw = (await withValue<SnapshotRecord | undefined>("readonly", (store) =>
    store.get("__last_session"),
  )) as SnapshotRecord | undefined;
  return raw === undefined ? null : (JSON.parse(raw.projectJson) as unknown);
}

/** Lists the named snapshots (crash slot excluded). */
export async function listSnapshots(): Promise<{ name: string; createdAt: number }[]> {
  const raw = (await withValue<SnapshotRecord[]>("readonly", (store) =>
    store.getAll(),
  )) as SnapshotRecord[];
  return raw
    .filter((r) => r.name !== "__last_session")
    .map((r) => ({ name: r.name, createdAt: r.createdAt }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Loads one named snapshot back into a project object. */
export async function loadSnapshot(name: string): Promise<unknown | null> {
  const raw = await withValue<SnapshotRecord | undefined>(
    "readonly",
    (store) => store.get(name) as IDBRequest<SnapshotRecord | undefined>,
  );
  return raw === undefined ? null : (JSON.parse(raw.projectJson) as unknown);
}

/** Deletes one snapshot. */
export async function deleteSnapshot(name: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(name));
}
