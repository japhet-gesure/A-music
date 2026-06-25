export class SafeStorage implements Storage {
  private inMemory: Record<string, string> = {};
  private realStorage: Storage | null = null;
  private storageType: "localStorage" | "sessionStorage";

  constructor(type: "localStorage" | "sessionStorage") {
    this.storageType = type;
    try {
      if (typeof window !== "undefined") {
        const storage = window[type];
        // Test if storage is actually accessible/usable
        const testKey = `__storage_test_${type}__`;
        storage.setItem(testKey, "test");
        storage.removeItem(testKey);
        this.realStorage = storage;
      }
    } catch (e) {
      console.warn(`[SafeStorage] ${type} is blocked or unavailable, falling back to in-memory store:`, e);
    }
  }

  get length(): number {
    if (this.realStorage) {
      try {
        return this.realStorage.length;
      } catch (e) {
        // Fallback
      }
    }
    return Object.keys(this.inMemory).length;
  }

  clear(): void {
    if (this.realStorage) {
      try {
        this.realStorage.clear();
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.inMemory = {};
  }

  getItem(key: string): string | null {
    if (this.realStorage) {
      try {
        return this.realStorage.getItem(key);
      } catch (e) {
        // Fallback
      }
    }
    return this.inMemory[key] !== undefined ? this.inMemory[key] : null;
  }

  key(index: number): string | null {
    if (this.realStorage) {
      try {
        return this.realStorage.key(index);
      } catch (e) {
        // Fallback
      }
    }
    return Object.keys(this.inMemory)[index] || null;
  }

  removeItem(key: string): void {
    if (this.realStorage) {
      try {
        this.realStorage.removeItem(key);
        return;
      } catch (e) {
        // Fallback
      }
    }
    delete this.inMemory[key];
  }

  setItem(key: string, value: string): void {
    if (this.realStorage) {
      try {
        this.realStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.inMemory[key] = String(value);
  }
}

export const safeLocalStorage = new SafeStorage("localStorage");
export const safeSessionStorage = new SafeStorage("sessionStorage");
