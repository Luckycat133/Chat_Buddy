
// Constants
export const AI_LOCATIONS = {
    'ai-miku': ['Tokyo·Virtual Concert Hall', '札幌·雪初音舞台', 'Crypton Studio', '虚拟世界·MIKU EXPO'],
    'ai-rem': ['Roswaal Manor', '罗兹瓦尔宅邸·厨房', 'Arlam Village', '卢格尼卡王国'],
    'ai-naruto': ['Konohagakure', '木叶村·一乐拉面', 'Training Ground 7', '火影岩'],
    'ai-l': ['Kira Investigation HQ', '日本警察厅', 'Wammy\'s House', '某高级酒店'],
    'ai-zerotwo': ['Plantation 13', '樱花林', 'FRANXX Cockpit', '海边悬崖'],
    'ai-gojo': ['Jujutsu High', '东京都立咒术高专', 'Shibuya', '渋谷·封印之地'],
    'ai-rin': ['Fuyuki City', '冬木市·远坂宅邸', 'Clock Tower', '魔术工房'],
    'ai-asuna': ['Aincrad Floor 22', '艾恩葛朗特·小木屋', 'ALO Fairy World', 'SAO Survivor School'],
    'ai-1': ['Stargazing Hill', '天文台', 'Cozy Café', '独立音乐节'],
    'ai-2': ['Gaming Arena', '电竞馆', 'Tech Lab', '黑客空间'],
    'ai-3': ['Home Kitchen', '美食街', 'Bakery', '私房菜馆'],
    'ai-4': ['British Library', '历史博物馆', 'Chess Club', '古典书店'],
    'ai-5': ['Yoga Studio', '健身房', 'Mountain Trail', '晨跑公园'],
};

export const DEFAULT_LOCATIONS = ['Home', '家里', 'Somewhere nice ✨', '某个美好的地方 ✨'];

// API Call — delegates to shared chatService for unified config / retry / timeout
import { callAI } from '../../chat/services/chatService';

export async function callMomentsAI(messages, maxTokens = 200) {
    return callAI(messages, { temperature: 0.9, maxTokens, agentId: 'moments' });
}

// Helpers
export function getTimeContext() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 9) return 'early morning';
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 14) return 'lunch time';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 21) return 'evening';
    return 'late night';
}

export function getRandomLocation(aiId) {
    const locations = AI_LOCATIONS[aiId] || DEFAULT_LOCATIONS;
    return locations[Math.floor(Math.random() * locations.length)];
}

export function generatePostSystemPrompt(persona, timeContext, location) {
    return `You are ${persona.name} (${persona.name_zh}).
Personality: ${persona.personality}
Style: ${persona.style}
Interests: ${persona.interests?.join(', ')}

Current time context: ${timeContext}
Location: ${location}

Write one Moments-style post this character would share:
- 1-3 sentences, natural and in character
- Chinese / English / mixed when suitable
- include fitting emojis and time-of-day vibe

Output only the post text.`;
}

export function generateCommentSystemPrompt(persona, postAuthorName, postContent, existingComments = '', replyToComment = null) {
    return `You are ${persona.name}.
Personality: ${persona.personality}
Style: ${persona.style}

A friend "${postAuthorName}" posted: "${postContent}"

${existingComments ? `Recent comments:\n${existingComments}` : ''}

${replyToComment ? `You are replying to ${replyToComment.authorName}'s comment: "${replyToComment.content}"` : ''}

Write a natural in-character comment (max 1 sentence).
Output only the comment text.`;
}

export function evaluateInterestMatch(postContent, interests) {
    if (!interests || !interests.length) return false;
    const contentLower = postContent.toLowerCase();
    return interests.some(interest => contentLower.includes(interest.toLowerCase()));
}

// -----------------------------------------------------------------------------
// Story Events
// -----------------------------------------------------------------------------

export function generateBirthdayPostSystemPrompt(persona) {
    return `You are ${persona.name} (${persona.name_zh}).
Personality: ${persona.personality}
Style: ${persona.style}
Interests: ${persona.interests?.join(', ')}

Today is your birthday. Write a 1-3 sentence in-character celebratory post.
Use birthday emojis 🎂🎉🎊 and keep it genuine.
Output only the post text.`;
}

export function generateHolidayPostSystemPrompt(persona, holidayName) {
    return `You are ${persona.name} (${persona.name_zh}).
Personality: ${persona.personality}
Style: ${persona.style}
Interests: ${persona.interests?.join(', ')}

Today is ${holidayName}. Write a 1-3 sentence in-character holiday greeting.
Include fitting holiday emojis.
Output only the post text.`;
}

const SEASONAL_EVENTS = [
    { month: 1, day: 1, nameEn: "New Year's Day", nameZh: '新年' },
    { month: 2, day: 14, nameEn: "Valentine's Day", nameZh: '情人节' },
    { month: 10, day: 31, nameEn: 'Halloween', nameZh: '万圣节' },
    { month: 12, day: 25, nameEn: 'Christmas', nameZh: '圣诞节' },
];

// Birthday map: persona id → 'MM-DD'
const PERSONA_BIRTHDAYS = {
    'ai-1': '01-23',      // Luna
    'ai-2': '06-15',      // Max
    'ai-3': '04-08',      // Bella
    'ai-4': '09-22',      // Oliver
    'ai-5': '11-05',      // Sophie
    'ai-miku': '08-31',   // Hatsune Miku (canonical)
    'ai-rem': '02-02',    // Rem
    'ai-rin': '02-03',    // Rin Tohsaka
    'ai-naruto': '10-10', // Naruto Uzumaki
    'ai-l': '10-31',      // L
    'ai-zerotwo': '02-27',// Zero Two
    'ai-asuna': '09-30',  // Asuna
    'ai-gojo': '12-07',   // Gojo Satoru
};

export function getTodayEvents() {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-based
    const day = now.getDate();
    const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const birthdays = Object.entries(PERSONA_BIRTHDAYS)
        .filter(([, bd]) => bd === mmdd)
        .map(([id]) => id);

    const holiday = SEASONAL_EVENTS.find(e => e.month === month && e.day === day) || null;

    return { birthdays, holiday };
}
