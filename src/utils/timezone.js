/**
 * Timezone Utility Functions
 * Shared utilities for timezone-aware date/time operations.
 */

/**
 * Get the current hour in a given IANA timezone.
 * Falls back to local time if Intl is not available or timezone is invalid.
 *
 * @param {string} timezone - IANA timezone string (e.g., 'Asia/Shanghai')
 * @returns {number} Current hour in 24-hour format (0-23)
 */
export function getCurrentHour(timezone) {
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