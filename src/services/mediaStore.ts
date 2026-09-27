// IndexedDB Media Store for local video tours & large images
// Bypasses browser localStorage 5MB quota limit seamlessly

const DB_NAME = 'SwarajMediaStoreDB';
const STORE_NAME = 'media_blobs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeLocalFile(file: File | Blob): Promise<string> {
  const mediaId = `idb_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(file, mediaId);
      req.onsuccess = () => resolve(`idb://${mediaId}`);
      req.onerror = () => reject(req.error);
    });
  } catch (_e) {
    return URL.createObjectURL(file);
  }
}

export async function resolveMediaUrl(url: string): Promise<string> {
  if (!url || !url.startsWith('idb://')) return url;
  const mediaId = url.replace('idb://', '');
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(mediaId);
      req.onsuccess = () => {
        if (req.result instanceof Blob || req.result instanceof File) {
          resolve(URL.createObjectURL(req.result));
        } else {
          resolve('https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-ocean-view-41484-large.mp4');
        }
      };
      req.onerror = () => resolve('https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-ocean-view-41484-large.mp4');
    });
  } catch (_e) {
    return url;
  }
}
