/**
 * MoodService — T06 Character Mood System
 *
 * Pure-function service that computes mood for each persona based on:
 * - Time of day (in persona's timezone)
 * - Presence status (offline/busy affects mood)
 * - Personality weighting (cheerful → happy bias, introspective → melancholy bias)
 *
 * 5 moods: happy, calm, tired, excited, melancholy
 */

export const MOODS = {
    happy: {
        id: 'happy',
        emoji: '\u{1F60A}',
        label: 'Happy',
        label_zh: '\u5F00\u5FC3',
        promptHint: "Great mood; be upbeat and positive."
    },
    calm: {
        id: 'calm',
        emoji: '\u{1F60C}',
        label: 'Calm',
        label_zh: '\u5E73\u9759',
        promptHint: 'Peaceful and steady tone.'
    },
    tired: {
        id: 'tired',
        emoji: '\u{1F634}',
        label: 'Tired',
        label_zh: '\u56F0\u5026',
        promptHint: 'Low energy; keep responses shorter.'
    },
    excited: {
        id: 'excited',
        emoji: '\u{1F929}',
        label: 'Excited',
        label_zh: '\u5174\u596E',
        promptHint: 'Excited and energetic voice.'
    },
    melancholy: {
        id: 'melancholy',
        emoji: '\u{1F614}',
        label: 'Melancholy',
        label_zh: '\u6DF1\u601D',
        promptHint: 'Reflective, slightly wistful tone.'
    }
};

/**
 * Get the current hour in a given IANA timezone.
 * @param {string} timezone
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
 * Determine personality weight from persona personality string.
 * Returns a bias object: { cheerful, introspective, energetic }
 */
function getPersonalityWeight(personality = '') {
    const lower = personality.toLowerCase();
    const cheerfulWords = ['cheerful', 'happy', 'optimistic', 'bright', 'bubbly', 'warm', 'friendly', 'cute'];
    const introspectiveWords = ['thoughtful', 'reflective', 'philosophical', 'deep', 'quiet', 'calm', 'mysterious', 'melancholy'];
    const energeticWords = ['energetic', 'excitable', 'passionate', 'wild', 'bold', 'adventurous', 'curious', 'excited'];

    let cheerful = 0, introspective = 0, energetic = 0;
    for (const w of cheerfulWords) if (lower.includes(w)) cheerful++;
    for (const w of introspectiveWords) if (lower.includes(w)) introspective++;
    for (const w of energeticWords) if (lower.includes(w)) energetic++;

    return { cheerful, introspective, energetic };
}

/**
 * Compute the mood for a single persona.
 * @param {Object} persona
 * @param {string} presenceStatus - 'online'|'busy'|'offline'
 * @returns {Object} mood object from MOODS
 */
export function computeMood(persona, presenceStatus) {
    const tz = persona?.schedule?.timezone || 'Asia/Shanghai';
    const hour = getCurrentHour(tz);
    const weight = getPersonalityWeight(persona?.personality || '');

    // Presence overrides
    if (presenceStatus === 'offline') return MOODS.tired;
    if (presenceStatus === 'busy') return MOODS.calm;

    // Time-based mood candidates with weights
    // morning 6-11, afternoon 12-17, evening 18-22, late night 23-5
    let candidates;
    if (hour >= 6 && hour < 12) {
        // Morning: calm or happy
        candidates = [
            { mood: MOODS.calm, w: 3 + weight.introspective },
            { mood: MOODS.happy, w: 3 + weight.cheerful },
            { mood: MOODS.excited, w: 1 + weight.energetic },
        ];
    } else if (hour >= 12 && hour < 18) {
        // Afternoon: happy or excited
        candidates = [
            { mood: MOODS.happy, w: 3 + weight.cheerful },
            { mood: MOODS.excited, w: 2 + weight.energetic },
            { mood: MOODS.calm, w: 1 + weight.introspective },
        ];
    } else if (hour >= 18 && hour < 23) {
        // Evening: calm, melancholy
        candidates = [
            { mood: MOODS.calm, w: 3 + weight.introspective },
            { mood: MOODS.happy, w: 2 + weight.cheerful },
            { mood: MOODS.melancholy, w: 1 + weight.introspective },
        ];
    } else {
        // Late night (23-5): tired, melancholy
        candidates = [
            { mood: MOODS.tired, w: 3 },
            { mood: MOODS.melancholy, w: 2 + weight.introspective },
            { mood: MOODS.calm, w: 1 },
        ];
    }

    // Deterministic selection based on persona id hash + current hour
    // This keeps mood stable within the same hour for the same persona
    const hash = hashCode(persona?.id || 'default') + hour;
    const totalWeight = candidates.reduce((sum, c) => sum + c.w, 0);
    let pick = ((hash % totalWeight) + totalWeight) % totalWeight;

    for (const c of candidates) {
        pick -= c.w;
        if (pick < 0) return c.mood;
    }

    return MOODS.calm;
}

/**
 * Simple string hash for deterministic mood selection.
 */
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * Compute mood map for all personas.
 * @param {Array} personas
 * @param {Object} presenceMap - { personaId: 'online'|'offline'|'busy' }
 * @returns {Object} { personaId: moodObject }
 */
export function getMoodMap(personas, presenceMap = {}) {
    const map = {};
    for (const p of personas) {
        if (p.id && p.id !== 'user-me') {
            map[p.id] = computeMood(p, presenceMap[p.id] || 'online');
        }
    }
    return map;
}
