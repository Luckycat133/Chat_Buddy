/**
 * Time formatting utilities for WeChat-style time display
 * Supports both English and Chinese localization
 */

/**
 * Format a timestamp into a relative or absolute time string
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @param {string} language - 'en' or 'zh'
 * @returns {string} Formatted time string
 */
export function formatRelativeTime(timestamp, language = 'en') {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    // Format time as HH:mm
    const timeStr = date.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // Just now (< 1 minute)
    if (diffMinutes < 1) {
        return language === 'zh' ? '刚刚' : 'Just now';
    }

    // X minutes ago (< 60 minutes)
    if (diffMinutes < 60) {
        return language === 'zh'
            ? `${diffMinutes}分钟前`
            : `${diffMinutes} min ago`;
    }

    // Check if same day
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return timeStr;
    }

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) {
        return language === 'zh'
            ? `昨天 ${timeStr}`
            : `Yesterday ${timeStr}`;
    }

    // Check if same year
    const isSameYear = date.getFullYear() === now.getFullYear();
    if (isSameYear) {
        if (language === 'zh') {
            return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            }) + ` ${timeStr}`;
        }
    }

    // Different year - show full date
    if (language === 'zh') {
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } else {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

/**
 * Format timestamp for chat list preview
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @param {string} language - 'en' or 'zh'
 * @returns {string} Short formatted time string
 */
export function formatChatListTime(timestamp, language = 'en') {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 1000 / 60);

    // Format time as HH:mm
    const timeStr = date.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // Today - show time only
    if (date.toDateString() === now.toDateString()) {
        return timeStr;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return language === 'zh' ? '昨天' : 'Yesterday';
    }

    // This week (within 7 days)
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
        const weekdays = language === 'zh'
            ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return weekdays[date.getDay()];
    }

    // Same year - show month/day
    if (date.getFullYear() === now.getFullYear()) {
        if (language === 'zh') {
            return `${date.getMonth() + 1}/${date.getDate()}`;
        } else {
            return `${date.getMonth() + 1}/${date.getDate()}`;
        }
    }

    // Different year
    if (language === 'zh') {
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    } else {
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`;
    }
}

/**
 * Determine if a time separator should be shown between two messages
 * @param {string|Date} prevTimestamp - Previous message timestamp
 * @param {string|Date} currentTimestamp - Current message timestamp
 * @param {number} thresholdMinutes - Minutes threshold (default 5)
 * @returns {boolean} True if separator should be shown
 */
export function shouldShowTimeSeparator(prevTimestamp, currentTimestamp, thresholdMinutes = 5) {
    if (!prevTimestamp) return true; // Always show for first message

    const prevDate = new Date(prevTimestamp);
    const currentDate = new Date(currentTimestamp);
    const diffMs = currentDate - prevDate;
    const diffMinutes = Math.floor(diffMs / 1000 / 60);

    return diffMinutes >= thresholdMinutes;
}

/**
 * Format timestamp for time separator display
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @param {string} language - 'en' or 'zh'
 * @returns {string} Separator text
 */
export function formatTimeSeparator(timestamp, language = 'en') {
    const date = new Date(timestamp);
    const now = new Date();

    // Format time as HH:mm
    const timeStr = date.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // Today
    if (date.toDateString() === now.toDateString()) {
        return timeStr;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return language === 'zh' ? `昨天 ${timeStr}` : `Yesterday ${timeStr}`;
    }

    // This year
    if (date.getFullYear() === now.getFullYear()) {
        if (language === 'zh') {
            return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
        } else {
            const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `${monthDay} ${timeStr}`;
        }
    }

    // Different year
    if (language === 'zh') {
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
    } else {
        const fullDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        return `${fullDate} ${timeStr}`;
    }
}
