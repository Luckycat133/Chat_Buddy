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
 */

/**
 * Get the current hour in a given IANA timezone.
 * Falls back to local time if Intl is not available.
 * @param {string} timezone - e.g. 'Asia/Shanghai'
 * @returns {number} 0-23
 */
function getCurrentHour(timezone) {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone: timezone,
        });
        return parseInt(formatter.format(new Date()), 10);
    } catch (_e) {
        return new Date().getHours();
    }
}

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
 * @returns {'online' | 'offline' | 'busy'}
 */
export function getStatus(persona) {
    const schedule = persona?.schedule;
    if (!schedule) return 'online'; // No schedule → always online

    const tz = schedule.timezone || 'Asia/Shanghai';
    const hour = getCurrentHour(tz);

    // 1. Sleep check (highest priority)
    if (isInRange(hour, schedule.sleep)) {
        return 'offline';
    }

    // 2. Busy check
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
 * @returns {Object} { personaId: 'online'|'offline'|'busy', ... }
 */
export function getPresenceMap(personas) {
    const map = {};
    for (const p of personas) {
        if (p.id && p.id !== 'user-me') {
            map[p.id] = getStatus(p);
        }
    }
    return map;
}
