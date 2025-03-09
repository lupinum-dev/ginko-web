type Cache = Map<string, string>;
type CacheType = 'meta' | 'asset';
type CacheResult = {
  metaCache: Cache;
  assetCache: Cache;
};

const STORAGE_KEYS = {
  meta: 'ginko-meta-cache',
  asset: 'ginko-asset-cache'
} as const;

// Pure functions for cache operations
const parseStorageData = (data: string | null): Cache => {
  try {
    return new Map(JSON.parse(data || '[]'));
  } catch {
    return new Map();
  }
};

const serializeCache = (cache: Cache): string => 
  JSON.stringify(Array.from(cache.entries()));

// Batch cache manager
export const createBatchCacheManager = () => {
  let currentCache: CacheResult | null = null;

  const loadFromStorage = (): CacheResult => ({
    metaCache: parseStorageData(localStorage.getItem(STORAGE_KEYS.meta)),
    assetCache: parseStorageData(localStorage.getItem(STORAGE_KEYS.asset))
  });

  const saveToStorage = (caches: CacheResult): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.meta, serializeCache(caches.metaCache));
      localStorage.setItem(STORAGE_KEYS.asset, serializeCache(caches.assetCache));
    } catch (error) {
      console.error('Error saving caches to localStorage:', error);
    }
  };

  return {
    startBatch: (): CacheResult => {
      currentCache = loadFromStorage();
      return currentCache;
    },

    getCurrentCache: (): CacheResult => {
      if (!currentCache) {
        currentCache = loadFromStorage();
      }
      return currentCache;
    },

    completeBatch: (): void => {
      if (currentCache) {
        console.log('🔄 Saving caches to localStorage', currentCache);
        saveToStorage(currentCache);
        currentCache = null;
      }
    },

    // Add delete operations
    deleteMeta: (key: string): void => {
      if (currentCache) {
        currentCache.metaCache.delete(key);
      }
    },

    deleteAsset: (key: string): void => {
      if (currentCache) {
        currentCache.assetCache.delete(key);
      }
    },

    // Convenience methods for working with current batch
    getMeta: (key: string): string | null => 
      currentCache?.metaCache.get(key) || null,

    setMeta: (key: string, value: string): void => {
      if (currentCache) {
        currentCache.metaCache.set(key, value);
      }
    },

    getAsset: (key: string): string | null => 
      currentCache?.assetCache.get(key) || null,

    setAsset: (key: string, value: string): void => {
      if (currentCache) {
        currentCache.assetCache.set(key, value);
      }
    }
  };
};
