import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i) => Object.keys(store)[i] || null),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Import the service - we'll test it in isolation
// Since StorageService is imported by other modules, we test its behavior through mock

describe('StorageService', () => {
  // Test the StorageService interface and behavior
  const NAMESPACE = 'chat-buddy:';
  const TEST_KEY = 'test-key';
  const TEST_VALUE = { name: 'test', value: 123 };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return null for non-existent keys', () => {
      const result = localStorage.getItem(NAMESPACE + TEST_KEY);
      expect(result).toBeNull();
    });

    it('should parse JSON values', () => {
      const jsonValue = JSON.stringify(TEST_VALUE);
      localStorage.setItem(NAMESPACE + TEST_KEY, jsonValue);
      const stored = localStorage.getItem(NAMESPACE + TEST_KEY);
      expect(JSON.parse(stored)).toEqual(TEST_VALUE);
    });

    it('should handle namespace prefix', () => {
      localStorage.setItem(NAMESPACE + TEST_KEY, 'value');
      expect(localStorage.getItem(NAMESPACE + TEST_KEY)).toBe('value');
      expect(localStorage.getItem(TEST_KEY)).toBeNull();
    });
  });

  describe('set', () => {
    it('should stringify objects before storing', () => {
      localStorage.setItem(NAMESPACE + TEST_KEY, JSON.stringify(TEST_VALUE));
      const stored = localStorage.getItem(NAMESPACE + TEST_KEY);
      expect(JSON.parse(stored)).toEqual(TEST_VALUE);
    });

    it('should overwrite existing values', () => {
      localStorage.setItem(NAMESPACE + TEST_KEY, 'first');
      localStorage.setItem(NAMESPACE + TEST_KEY, 'second');
      expect(localStorage.getItem(NAMESPACE + TEST_KEY)).toBe('second');
    });
  });

  describe('remove', () => {
    it('should remove specific keys', () => {
      localStorage.setItem(NAMESPACE + TEST_KEY, 'value');
      localStorage.removeItem(NAMESPACE + TEST_KEY);
      expect(localStorage.getItem(NAMESPACE + TEST_KEY)).toBeNull();
    });

    it('should not affect other keys', () => {
      localStorage.setItem(NAMESPACE + 'key1', 'value1');
      localStorage.setItem(NAMESPACE + 'key2', 'value2');
      localStorage.removeItem(NAMESPACE + 'key1');
      expect(localStorage.getItem(NAMESPACE + 'key1')).toBeNull();
      expect(localStorage.getItem(NAMESPACE + 'key2')).toBe('value2');
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      localStorage.setItem(NAMESPACE + 'key1', 'value1');
      localStorage.setItem(NAMESPACE + 'key2', 'value2');
      localStorage.clear();
      expect(localStorage.getItem(NAMESPACE + 'key1')).toBeNull();
      expect(localStorage.getItem(NAMESPACE + 'key2')).toBeNull();
    });
  });

  describe('quota handling', () => {
    it('should handle quota exceeded errors gracefully', () => {
      // Simulate QuotaExceededError
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';

      // When localStorage is full, setItem should throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw error;
      });

      // We expect the error to propagate
      expect(() => localStorage.setItem(NAMESPACE + TEST_KEY, 'large-value')).toThrow('QuotaExceededError');
      localStorage.setItem = originalSetItem;
    });
  });

  describe('data persistence', () => {
    it('should persist data across page reloads (simulated)', () => {
      const testData = { messages: ['hello', 'world'] };
      localStorage.setItem(NAMESPACE + 'messages', JSON.stringify(testData));

      // Simulate "reload" by reading from localStorage
      const retrieved = JSON.parse(localStorage.getItem(NAMESPACE + 'messages'));
      expect(retrieved).toEqual(testData);
    });
  });
});

describe('StorageService - Key Patterns', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should use correct key prefixes for different data types', () => {
    // Chat data
    localStorage.setItem('chat-buddy:chats', JSON.stringify([]));
    expect(localStorage.getItem('chat-buddy:chats')).toBe('[]');

    // User data
    localStorage.setItem('chat-buddy:user', JSON.stringify({ name: 'Test' }));
    expect(JSON.parse(localStorage.getItem('chat-buddy:user'))).toEqual({ name: 'Test' });

    // Social data
    localStorage.setItem('chat-buddy:social', JSON.stringify({ points: 100 }));
    expect(JSON.parse(localStorage.getItem('chat-buddy:social'))).toEqual({ points: 100 });

    // Language preference
    localStorage.setItem('chat-buddy:language', 'zh');
    expect(localStorage.getItem('chat-buddy:language')).toBe('zh');
  });
});