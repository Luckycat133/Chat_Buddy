import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatRelativeTime,
  formatChatListTime,
  shouldShowTimeSeparator,
  formatTimeSeparator
} from './formatTime';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Mock当前时间为固定值
    vi.setSystemTime(new Date('2026-02-08T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('中文格式', () => {
    it('应该返回"刚刚"当时间差小于1分钟', () => {
      const timestamp = new Date('2026-02-08T09:59:30Z').toISOString();
      expect(formatRelativeTime(timestamp, 'zh')).toBe('刚刚');
    });

    it('应该返回"X分钟前"当时间差在1-59分钟', () => {
      const timestamp = new Date('2026-02-08T09:45:00Z').toISOString();
      expect(formatRelativeTime(timestamp, 'zh')).toBe('15分钟前');
    });

    it('应该返回时间当消息在今天但超过1小时', () => {
      const timestamp = new Date('2026-02-08T08:30:00Z').toISOString();
      const result = formatRelativeTime(timestamp, 'zh');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('应该返回"昨天 HH:mm"当消息在昨天', () => {
      const timestamp = new Date('2026-02-07T15:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp, 'zh');
      expect(result).toContain('昨天');
      expect(result).toMatch(/昨天 \d{2}:\d{2}/);
    });

    it('应该返回月日时间当消息在今年但不是昨天', () => {
      const timestamp = new Date('2026-01-15T10:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp, 'zh');
      expect(result).toContain('月');
      expect(result).toContain('日');
    });

    it('应该返回完整日期当消息在不同年份', () => {
      const timestamp = new Date('2025-12-25T10:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp, 'zh');
      expect(result).toContain('2025');
      expect(result).toContain('年');
    });
  });

  describe('英文格式', () => {
    it('应该返回"Just now"当时间差小于1分钟', () => {
      const timestamp = new Date('2026-02-08T09:59:40Z').toISOString();
      expect(formatRelativeTime(timestamp, 'en')).toBe('Just now');
    });

    it('应该返回"X min ago"当时间差在1-59分钟', () => {
      const timestamp = new Date('2026-02-08T09:40:00Z').toISOString();
      expect(formatRelativeTime(timestamp, 'en')).toBe('20 min ago');
    });

    it('应该返回时间当消息在今天但超过1小时', () => {
      const timestamp = new Date('2026-02-08T07:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp, 'en');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('应该返回"Yesterday HH:mm"当消息在昨天', () => {
      const timestamp = new Date('2026-02-07T14:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp, 'en');
      expect(result).toContain('Yesterday');
      expect(result).toMatch(/Yesterday \d{2}:\d{2}/);
    });

    it('应该返回月份日期当消息在今年但不是昨天', () => {
      const timestamp = new Date('2026-01-20T10:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp, 'en');
      expect(result).toMatch(/Jan \d{1,2}/);
    });

    it('应该返回完整日期当消息在不同年份', () => {
      const timestamp = new Date('2025-11-15T10:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp, 'en');
      expect(result).toContain('2025');
    });
  });

  describe('边界情况', () => {
    it('应该处理恰好60分钟的时间差', () => {
      const timestamp = new Date('2026-02-08T09:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp, 'zh');
      expect(result).not.toContain('分钟前');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('应该处理恰好1分钟的时间差', () => {
      const timestamp = new Date('2026-02-08T09:59:00Z').toISOString();
      expect(formatRelativeTime(timestamp, 'zh')).toBe('1分钟前');
    });

    it('应该处理Date对象作为输入', () => {
      const date = new Date('2026-02-08T09:45:00Z');
      expect(formatRelativeTime(date, 'zh')).toBe('15分钟前');
    });
  });
});

describe('formatChatListTime', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-02-08T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('中文格式', () => {
    it('应该返回时间当消息在今天', () => {
      const timestamp = new Date('2026-02-08T09:30:00Z').toISOString();
      const result = formatChatListTime(timestamp, 'zh');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('应该返回"昨天"当消息在昨天', () => {
      const timestamp = new Date('2026-02-07T10:00:00Z').toISOString();
      expect(formatChatListTime(timestamp, 'zh')).toBe('昨天');
    });

    it('应该返回星期几当消息在本周(2-6天前)', () => {
      const timestamp = new Date('2026-02-05T10:00:00Z').toISOString(); // 3天前
      const result = formatChatListTime(timestamp, 'zh');
      expect(result).toMatch(/周[一二三四五六日]/);
    });

    it('应该返回M/D当消息在今年但超过一周', () => {
      const timestamp = new Date('2026-01-15T10:00:00Z').toISOString();
      const result = formatChatListTime(timestamp, 'zh');
      expect(result).toMatch(/^\d{1,2}\/\d{1,2}$/);
    });

    it('应该返回完整日期当消息在不同年份', () => {
      const timestamp = new Date('2025-12-25T10:00:00Z').toISOString();
      const result = formatChatListTime(timestamp, 'zh');
      expect(result).toContain('2025');
      expect(result).toMatch(/2025\/\d{1,2}\/\d{1,2}/);
    });
  });

  describe('英文格式', () => {
    it('应该返回时间当消息在今天', () => {
      const timestamp = new Date('2026-02-08T08:00:00Z').toISOString();
      const result = formatChatListTime(timestamp, 'en');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('应该返回"Yesterday"当消息在昨天', () => {
      const timestamp = new Date('2026-02-07T12:00:00Z').toISOString();
      expect(formatChatListTime(timestamp, 'en')).toBe('Yesterday');
    });

    it('应该返回星期几缩写当消息在本周', () => {
      const timestamp = new Date('2026-02-04T10:00:00Z').toISOString(); // 4天前
      const result = formatChatListTime(timestamp, 'en');
      expect(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).toContain(result);
    });

    it('应该返回M/D当消息在今年但超过一周', () => {
      const timestamp = new Date('2026-01-10T10:00:00Z').toISOString();
      const result = formatChatListTime(timestamp, 'en');
      expect(result).toMatch(/^\d{1,2}\/\d{1,2}$/);
    });

    it('应该返回M/D/YY当消息在不同年份', () => {
      const timestamp = new Date('2025-11-20T10:00:00Z').toISOString();
      const result = formatChatListTime(timestamp, 'en');
      expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{2}$/);
      expect(result).toContain('/25'); // 年份后两位
    });
  });
});

describe('shouldShowTimeSeparator', () => {
  it('应该返回true当没有前一条消息', () => {
    const result = shouldShowTimeSeparator(null, '2026-02-08T10:00:00Z');
    expect(result).toBe(true);
  });

  it('应该返回true当时间差超过阈值(默认5分钟)', () => {
    const prev = '2026-02-08T10:00:00Z';
    const current = '2026-02-08T10:06:00Z'; // 6分钟后
    expect(shouldShowTimeSeparator(prev, current)).toBe(true);
  });

  it('应该返回false当时间差小于阈值', () => {
    const prev = '2026-02-08T10:00:00Z';
    const current = '2026-02-08T10:03:00Z'; // 3分钟后
    expect(shouldShowTimeSeparator(prev, current)).toBe(false);
  });

  it('应该返回true当时间差恰好等于阈值', () => {
    const prev = '2026-02-08T10:00:00Z';
    const current = '2026-02-08T10:05:00Z'; // 恰好5分钟
    expect(shouldShowTimeSeparator(prev, current)).toBe(true);
  });

  it('应该支持自定义阈值', () => {
    const prev = '2026-02-08T10:00:00Z';
    const current = '2026-02-08T10:08:00Z'; // 8分钟后
    expect(shouldShowTimeSeparator(prev, current, 10)).toBe(false);
    expect(shouldShowTimeSeparator(prev, current, 5)).toBe(true);
  });

  it('应该处理Date对象', () => {
    const prev = new Date('2026-02-08T10:00:00Z');
    const current = new Date('2026-02-08T10:07:00Z');
    expect(shouldShowTimeSeparator(prev, current)).toBe(true);
  });
});

describe('formatTimeSeparator', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-02-08T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('中文格式', () => {
    it('应该返回时间当消息在今天', () => {
      const timestamp = new Date('2026-02-08T08:30:00Z').toISOString();
      const result = formatTimeSeparator(timestamp, 'zh');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('应该返回"昨天 HH:mm"当消息在昨天', () => {
      const timestamp = new Date('2026-02-07T15:00:00Z').toISOString();
      const result = formatTimeSeparator(timestamp, 'zh');
      expect(result).toContain('昨天');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('应该返回完整日期时间当消息在今年', () => {
      const timestamp = new Date('2026-01-20T14:30:00Z').toISOString();
      const result = formatTimeSeparator(timestamp, 'zh');
      expect(result).toContain('月');
      expect(result).toContain('日');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('应该返回完整日期时间当消息在不同年份', () => {
      const timestamp = new Date('2025-12-15T10:00:00Z').toISOString();
      const result = formatTimeSeparator(timestamp, 'zh');
      expect(result).toContain('2025');
      expect(result).toContain('年');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('英文格式', () => {
    it('应该返回时间当消息在今天', () => {
      const timestamp = new Date('2026-02-08T07:00:00Z').toISOString();
      const result = formatTimeSeparator(timestamp, 'en');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('应该返回"Yesterday HH:mm"当消息在昨天', () => {
      const timestamp = new Date('2026-02-07T16:00:00Z').toISOString();
      const result = formatTimeSeparator(timestamp, 'en');
      expect(result).toContain('Yesterday');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('应该返回完整日期时间当消息在今年', () => {
      const timestamp = new Date('2026-01-25T11:30:00Z').toISOString();
      const result = formatTimeSeparator(timestamp, 'en');
      expect(result).toMatch(/Jan \d{1,2}/);
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('应该返回完整日期时间当消息在不同年份', () => {
      const timestamp = new Date('2025-10-10T09:00:00Z').toISOString();
      const result = formatTimeSeparator(timestamp, 'en');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });
  });
});
