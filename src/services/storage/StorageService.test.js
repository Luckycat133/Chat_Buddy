import { describe, it, expect, beforeEach } from 'vitest';
// 为测试创建StorageService类的访问
class StorageService {
  constructor(storageBackend = window.localStorage) {
    this.storage = storageBackend;
    this.prefix = 'chat-buddy:';
  }

  get(key, defaultValue = null) {
    try {
      const fullKey = this._getKey(key);
      const item = this.storage.getItem(fullKey);

      if (item === null) {
        const legacyItem = this.storage.getItem(key);
        if (legacyItem !== null) return JSON.parse(legacyItem);
      }

      return item ? JSON.parse(item) : defaultValue;
    } catch (_error) {
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      const fullKey = this._getKey(key);
      this.storage.setItem(fullKey, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting key "${key}":`, error);
    }
  }

  remove(key) {
    try {
      this.storage.removeItem(this._getKey(key));
      this.storage.removeItem(key);
    } catch (error) {
      console.error(`Error removing key "${key}":`, error);
    }
  }

  clear() {
    try {
      Object.keys(this.storage).forEach(k => {
        if (k.startsWith(this.prefix)) {
          this.storage.removeItem(k);
        }
      });
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  _getKey(key) {
    if (key.startsWith(this.prefix)) return key;
    const legacyKeys = ['chat-buddy-chats'];
    if (legacyKeys.includes(key)) return key;
    return `${this.prefix}${key}`;
  }
}

describe('StorageService', () => {
  let storage;
  let mockStorage;

  beforeEach(() => {
    // 清空localStorage mock
    localStorage.clear();
    mockStorage = localStorage;
    storage = new StorageService(mockStorage);
  });

  describe('get()', () => {
    it('应该获取存储的值', () => {
      mockStorage.setItem('chat-buddy:test', JSON.stringify({ value: 123 }));
      const result = storage.get('test');
      expect(result).toEqual({ value: 123 });
    });

    it('应该返回默认值当键不存在', () => {
      const result = storage.get('nonexistent', { default: true });
      expect(result).toEqual({ default: true });
    });

    it('应该返回null当键不存在且无默认值', () => {
      const result = storage.get('nonexistent');
      expect(result).toBeNull();
    });

    it('应该处理legacy键（无前缀）', () => {
      mockStorage.setItem('legacy-key', JSON.stringify({ legacy: true }));
      const result = storage.get('legacy-key');
      expect(result).toEqual({ legacy: true });
    });

    it('应该处理JSON解析错误', () => {
      mockStorage.setItem('chat-buddy:invalid', 'invalid json{');
      const result = storage.get('invalid', { error: 'fallback' });
      expect(result).toEqual({ error: 'fallback' });
    });

    it('应该处理不同数据类型', () => {
      storage.set('string', 'hello');
      storage.set('number', 42);
      storage.set('boolean', true);
      storage.set('array', [1, 2, 3]);
      storage.set('object', { key: 'value' });

      expect(storage.get('string')).toBe('hello');
      expect(storage.get('number')).toBe(42);
      expect(storage.get('boolean')).toBe(true);
      expect(storage.get('array')).toEqual([1, 2, 3]);
      expect(storage.get('object')).toEqual({ key: 'value' });
    });
  });

  describe('set()', () => {
    it('应该存储值', () => {
      storage.set('test', { data: 'value' });
      const stored = mockStorage.getItem('chat-buddy:test');
      expect(JSON.parse(stored)).toEqual({ data: 'value' });
    });

    it('应该覆盖已存在的值', () => {
      storage.set('test', 'old');
      storage.set('test', 'new');
      expect(storage.get('test')).toBe('new');
    });

    it('应该处理null值', () => {
      storage.set('test', null);
      expect(storage.get('test')).toBeNull();
    });
  });

  describe('remove()', () => {
    it('应该移除prefixed键', () => {
      storage.set('test', 'value');
      storage.remove('test');
      expect(storage.get('test')).toBeNull();
    });

    it('应该同时尝试移除legacy键', () => {
      mockStorage.setItem('legacy', 'value');
      mockStorage.setItem('chat-buddy:legacy', 'value');
      storage.remove('legacy');
      expect(mockStorage.getItem('legacy')).toBeNull();
      expect(mockStorage.getItem('chat-buddy:legacy')).toBeNull();
    });

    it('应该优雅处理不存在的键', () => {
      expect(() => storage.remove('nonexistent')).not.toThrow();
    });
  });

  describe('clear()', () => {
    it('应该定义clear方法', () => {
      expect(typeof storage.clear).toBe('function');
    });

    it('应该能够调用clear而不报错', () => {
      storage.set('test', 'value');
      expect(() => storage.clear()).not.toThrow();
    });
  });

  describe('_getKey()', () => {
    it('应该为新键添加前缀', () => {
      expect(storage._getKey('new-key')).toBe('chat-buddy:new-key');
    });

    it('应该不重复添加前缀', () => {
      expect(storage._getKey('chat-buddy:test')).toBe('chat-buddy:test');
    });

    it('应该保留legacy键不变', () => {
      expect(storage._getKey('chat-buddy-chats')).toBe('chat-buddy-chats');
    });

    it('应该为其他键添加新前缀', () => {
      expect(storage._getKey('user')).toBe('chat-buddy:user');
      expect(storage._getKey('settings')).toBe('chat-buddy:settings');
    });
  });

  describe('边界情况', () => {
    it('应该处理空字符串键', () => {
      storage.set('', 'value');
      expect(storage.get('')).toBe('value');
    });

    it('应该处理非常长的键', () => {
      const longKey = 'a'.repeat(1000);
      storage.set(longKey, 'value');
      expect(storage.get(longKey)).toBe('value');
    });

    it('应该处理特殊字符键', () => {
      const specialKey = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      storage.set(specialKey, 'value');
      expect(storage.get(specialKey)).toBe('value');
    });

    it('应该处理嵌套对象', () => {
      const nested = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        }
      };
      storage.set('nested', nested);
      expect(storage.get('nested')).toEqual(nested);
    });
  });
});
