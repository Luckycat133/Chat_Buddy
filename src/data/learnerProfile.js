/**
 * Learner Profile - Tracks student knowledge state and preferences
 * Implements LRS-Lite (Learning Record Store) with localStorage
 */

const LEARNER_PROFILE_KEY = 'sensei_learner_profile';

/**
 * Default learner profile structure
 */
const DEFAULT_PROFILE = {
    mastered: [],           // Topics fully understood
    in_progress: [],        // Currently learning
    struggled_with: [],     // Topics with recorded difficulties
    misconceptions: [],     // Identified misunderstandings
    quiz_history: [],       // Past quiz attempts
    session_count: 0,       // Number of learning sessions
    total_time_minutes: 0,  // Estimated learning time
    preferences: {
        language: 'zh',
        example_style: 'code',  // 'code' | 'analogy' | 'visual'
        pace: 'normal'          // 'slow' | 'normal' | 'fast'
    },
    last_active: null
};

/**
 * Get learner profile from localStorage
 */
export function getLearnerProfile() {
    try {
        const stored = localStorage.getItem(LEARNER_PROFILE_KEY);
        if (stored) {
            return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('[LearnerProfile] Error reading profile:', e);
    }
    return { ...DEFAULT_PROFILE };
}

/**
 * Save learner profile to localStorage
 */
export function saveLearnerProfile(profile) {
    try {
        profile.last_active = new Date().toISOString();
        localStorage.setItem(LEARNER_PROFILE_KEY, JSON.stringify(profile));
        return true;
    } catch (e) {
        console.error('[LearnerProfile] Error saving profile:', e);
        return false;
    }
}

/**
 * Mark a topic as mastered
 */
export function markAsMastered(topicId) {
    const profile = getLearnerProfile();

    // Remove from other states
    profile.in_progress = profile.in_progress.filter(t => t !== topicId);
    profile.struggled_with = profile.struggled_with.filter(t => t !== topicId);

    // Add to mastered if not already
    if (!profile.mastered.includes(topicId)) {
        profile.mastered.push(topicId);
    }

    saveLearnerProfile(profile);
    return profile;
}

/**
 * Mark a topic as in progress
 */
export function markAsInProgress(topicId) {
    const profile = getLearnerProfile();

    if (!profile.in_progress.includes(topicId) && !profile.mastered.includes(topicId)) {
        profile.in_progress.push(topicId);
    }

    saveLearnerProfile(profile);
    return profile;
}

/**
 * Record a struggle with a topic
 */
export function recordStruggle(topicId, misconception = null) {
    const profile = getLearnerProfile();

    if (!profile.struggled_with.includes(topicId)) {
        profile.struggled_with.push(topicId);
    }

    if (misconception && !profile.misconceptions.includes(misconception)) {
        profile.misconceptions.push(misconception);
    }

    saveLearnerProfile(profile);
    return profile;
}

/**
 * Record a quiz attempt
 */
export function recordQuizAttempt(topicId, score, total) {
    const profile = getLearnerProfile();

    profile.quiz_history.push({
        topicId,
        score,
        total,
        percentage: Math.round((score / total) * 100),
        timestamp: new Date().toISOString()
    });

    // Auto-mark as mastered if score >= 80%
    if (score / total >= 0.8) {
        markAsMastered(topicId);
    }

    saveLearnerProfile(profile);
    return profile;
}

/**
 * Get learning summary for display
 */
export function getLearningSummary() {
    const profile = getLearnerProfile();

    return {
        masteredCount: profile.mastered.length,
        inProgressCount: profile.in_progress.length,
        strugglingCount: profile.struggled_with.length,
        quizzesTaken: profile.quiz_history.length,
        averageScore: profile.quiz_history.length > 0
            ? Math.round(profile.quiz_history.reduce((sum, q) => sum + q.percentage, 0) / profile.quiz_history.length)
            : 0,
        recentTopics: [...new Set([...profile.mastered, ...profile.in_progress])].slice(-5)
    };
}

/**
 * Check if learner has mastered a topic
 */
export function hasMastered(topicId) {
    const profile = getLearnerProfile();
    return profile.mastered.includes(topicId);
}

/**
 * Reset learner profile (for testing)
 */
export function resetLearnerProfile() {
    localStorage.removeItem(LEARNER_PROFILE_KEY);
    return DEFAULT_PROFILE;
}

export default {
    getLearnerProfile,
    saveLearnerProfile,
    markAsMastered,
    markAsInProgress,
    recordStruggle,
    recordQuizAttempt,
    getLearningSummary,
    hasMastered,
    resetLearnerProfile
};
