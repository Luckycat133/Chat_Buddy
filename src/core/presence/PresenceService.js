/**
 * PresenceService — T05 AI Humanization
 *
 * Pure-function service that calculates the online/offline/busy status
 * for each persona based on their `schedule` field and the current time.
 *
 * Status values:
 *   'online'  — Available, normal response time
 *   'busy'    — In a busy slot, may respond slower
 *   'offline' — In sleep range, appears offline
 *   'away'    — Away from keyboard, might be back soon
 *   'do-not-disturb' — Focused, not accepting interruptions
 */

import { getCurrentHour } from '../../utils/timezone';

/**
 * Check if current hour falls within a range that may wrap around midnight.
 * e.g. { start: 23, end: 7 } means 23:00 → 07:00 (overnight).
 * @param {number} hour - 0-23
 * @param {{ start: number, end: number }} range
 * @returns {boolean}
 */
function isInRange(hour, range) {
    if (!range || range.start == null || range.end == null) return false;

    if (range.start <= range.end) {
        // Normal range: e.g. 9-17
        return hour >= range.start && hour < range.end;
    }
    // Overnight range: e.g. 23-7
    return hour >= range.start || hour < range.end;
}

/**
 * Get the presence status of a single persona.
 * @param {Object} persona
 * @param {Object} userStatusOverride - User-set status override
 * @returns {'online' | 'offline' | 'busy' | 'away' | 'do-not-disturb'}
 */
export function getStatus(persona, userStatusOverride = null) {
    if (userStatusOverride && userStatusOverride !== 'auto') {
        return userStatusOverride;
    }

    const schedule = persona?.schedule;
    if (!schedule) return 'online';

    const tz = schedule.timezone || 'Asia/Shanghai';
    const hour = getCurrentHour(tz);

    if (isInRange(hour, schedule.sleep)) {
        return 'offline';
    }

    if (Array.isArray(schedule.busy)) {
        for (const slot of schedule.busy) {
            if (isInRange(hour, slot)) {
                return 'busy';
            }
        }
    }

    return 'online';
}

/**
 * Compute presence map for all personas.
 * @param {Array} personas
 * @param {Object} statusOverrides - User-set status overrides { personaId: status }
 * @returns {Object} { personaId: 'online'|'offline'|'busy'|'away'|'do-not-disturb', ... }
 */
export function getPresenceMap(personas, statusOverrides = {}) {
    const map = {};
    for (const p of personas) {
        if (p.id && p.id !== 'user-me') {
            map[p.id] = getStatus(p, statusOverrides[p.id]);
        }
    }
    return map;
}

/**
 * Status display configuration
 */
export const STATUS_CONFIG = {
    online: {
        color: '#4ECDC4',
        bgColor: 'bg-[var(--color-success)]',
        label: { en: 'Online', zh: '在线' },
        description: { en: 'Available for chat', zh: '可以聊天' },
        icon: '●'
    },
    offline: {
        color: '#94A3B8',
        bgColor: 'bg-slate-400',
        label: { en: 'Offline', zh: '离线' },
        description: { en: 'Currently away', zh: '当前不在' },
        icon: '○'
    },
    busy: {
        color: '#FB923C',
        bgColor: 'bg-orange-400',
        label: { en: 'Busy', zh: '忙碌' },
        description: { en: 'May respond slowly', zh: '可能回复较慢' },
        icon: '◐'
    },
    away: {
        color: '#FBBF24',
        bgColor: 'bg-yellow-400',
        label: { en: 'Away', zh: '离开' },
        description: { en: 'Away from keyboard', zh: '暂时离开' },
        icon: '◔'
    },
    'do-not-disturb': {
        color: '#F87171',
        bgColor: 'bg-red-400',
        label: { en: 'Do Not Disturb', zh: '勿扰' },
        description: { en: 'Focusing, no interruptions', zh: '专注中，请勿打扰' },
        icon: '⊘'
    }
};

/**
 * Get status configuration for display
 * @param {string} status - Status key
 * @param {string} language - 'en' or 'zh'
 * @returns {Object} Status display configuration
 */
export function getStatusConfig(status, language = 'en') {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.online;
    return {
        ...config,
        label: config.label[language] || config.label.en,
        description: config.description[language] || config.description.en
    };
}
