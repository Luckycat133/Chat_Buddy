/**
 * Time formatting utilities for WeChat-style time display
 * Supports both English and Chinese localization
 */

// ========== Common Helper Functions ==========

/**
 * Get date context information for time comparisons
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @returns {Object} Date context with comparison flags
 */
function getDateContext(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 1000 / 60);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return {
        date,
        now,
        diffMs,
        diffMinutes,
        diffDays,
        isToday: date.toDateString() === now.toDateString(),
        isYesterday: date.toDateString() === yesterday.toDateString(),
        isSameYear: date.getFullYear() === now.getFullYear()
    };
}

/**
 * Format time as HH:mm string
 * @param {Date} date - Date object
 * @param {string} language - 'en' or 'zh'
 * @returns {string} Formatted time string
 */
function formatTimeString(date, language = 'en') {
    return date.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * Format date as localized string (same year)
 * @param {Date} date - Date object
 * @param {string} language - 'en' or 'zh'
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} Formatted date string
 */
function formatDateSameYear(date, language, includeTime = false) {
    const timeStr = includeTime ? ` ${formatTimeString(date, language)}` : '';

    if (language === 'zh') {
        return `${date.getMonth() + 1}月${date.getDate()}日${timeStr}`;
    }
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    }) + timeStr;
}

/**
 * Format date as localized string (different year)
 * @param {Date} date - Date object
 * @param {string} language - 'en' or 'zh'
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} Formatted date string
 */
function formatDateDifferentYear(date, language, includeTime = false) {
    const timeStr = includeTime ? ` ${formatTimeString(date, language)}` : '';

    if (language === 'zh') {
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${timeStr}`;
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) + timeStr;
}

// ========== Exported Functions ==========

/**
 * Format a timestamp into a relative or absolute time string
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @param {string} language - 'en' or 'zh'
 * @returns {string} Formatted time string
 */
export function formatRelativeTime(timestamp, language = 'en') {
    const ctx = getDateContext(timestamp);
    const timeStr = formatTimeString(ctx.date, language);

    // Just now (< 1 minute)
    if (ctx.diffMinutes < 1) {
        return language === 'zh' ? '刚刚' : 'Just now';
    }

    // X minutes ago (< 60 minutes)
    if (ctx.diffMinutes < 60) {
        return language === 'zh'
            ? `${ctx.diffMinutes}分钟前`
            : `${ctx.diffMinutes} min ago`;
    }

    // Today
    if (ctx.isToday) {
        return timeStr;
    }

    // Yesterday
    if (ctx.isYesterday) {
        return language === 'zh' ? `昨天 ${timeStr}` : `Yesterday ${timeStr}`;
    }

    // Same year
    if (ctx.isSameYear) {
        return formatDateSameYear(ctx.date, language, true);
    }

    // Different year
    return formatDateDifferentYear(ctx.date, language, false);
}

/**
 * Format timestamp for chat list preview
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @param {string} language - 'en' or 'zh'
 * @returns {string} Short formatted time string
 */
export function formatChatListTime(timestamp, language = 'en') {
    const ctx = getDateContext(timestamp);
    const timeStr = formatTimeString(ctx.date, language);

    // Today - show time only
    if (ctx.isToday) {
        return timeStr;
    }

    // Yesterday
    if (ctx.isYesterday) {
        return language === 'zh' ? '昨天' : 'Yesterday';
    }

    // This week (within 7 days)
    if (ctx.diffDays < 7) {
        const weekdays = language === 'zh'
            ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return weekdays[ctx.date.getDay()];
    }

    // Same year - show month/day
    if (ctx.isSameYear) {
        return `${ctx.date.getMonth() + 1}/${ctx.date.getDate()}`;
    }

    // Different year
    if (language === 'zh') {
        return `${ctx.date.getFullYear()}/${ctx.date.getMonth() + 1}/${ctx.date.getDate()}`;
    }
    return `${ctx.date.getMonth() + 1}/${ctx.date.getDate()}/${ctx.date.getFullYear().toString().slice(-2)}`;
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
    const ctx = getDateContext(timestamp);
    const timeStr = formatTimeString(ctx.date, language);

    // Today
    if (ctx.isToday) {
        return timeStr;
    }

    // Yesterday
    if (ctx.isYesterday) {
        return language === 'zh' ? `昨天 ${timeStr}` : `Yesterday ${timeStr}`;
    }

    // Same year
    if (ctx.isSameYear) {
        return formatDateSameYear(ctx.date, language, true);
    }

    // Different year
    return formatDateDifferentYear(ctx.date, language, true);
}

