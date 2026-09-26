export interface OfflineQueueItem {
  queueId: string;
  recordType: 'encounter' | 'patient';
  patientId: string;
  patientName: string;
  community: string;
  summary: string;
  payload: any;
  validationStatus: 'complete' | 'needs_review' | 'duplicate_flagged';
  validationWarnings: string[];
  duplicateMatchCode?: string;
  createdTime: string;
  status: 'Pending' | 'Synchronizing' | 'Synchronized' | 'Failed';
  syncedTime?: string;
}

const DB_NAME = 'nexora_health_offline_db';
const DB_VERSION = 1;
const STORE_QUEUE = 'offline_sync_queue';
const STORE_META = 'offline_meta_state';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'queueId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdTime', 'createdTime', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineQueueItems(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as OfflineQueueItem[]) || [];
        items.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('IndexedDB read error:', err);
    return [];
  }
}

export async function saveOfflineQueueItem(item: OfflineQueueItem): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateOfflineQueueItemStatus(
  queueId: string,
  status: OfflineQueueItem['status'],
  syncedTime?: string
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const getReq = store.get(queueId);
    getReq.onsuccess = () => {
      const existing = getReq.result as OfflineQueueItem | undefined;
      if (existing) {
        existing.status = status;
        if (syncedTime) existing.syncedTime = syncedTime;
        store.put(existing);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMetaValue<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && typeof req.result.value !== 'undefined') {
          resolve(req.result.value as T);
        } else {
          resolve(defaultValue);
        }
      };
      req.onerror = () => resolve(defaultValue);
    });
  } catch {
    return defaultValue;
  }
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('IndexedDB meta write error:', err);
  }
}
