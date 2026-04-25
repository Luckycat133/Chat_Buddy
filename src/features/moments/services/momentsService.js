import { callAI } from '../../chat/services/chatService';
import { detectMomentLanguage } from './momentsContentService';

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

export const DEFAULT_LOCATIONS = ['Home', '家里', 'Somewhere nice', '某个美好的地方'];

const SEASONAL_EVENTS = [
    { month: 1, day: 1, nameEn: "New Year's Day", nameZh: '新年' },
    { month: 2, day: 14, nameEn: "Valentine's Day", nameZh: '情人节' },
    { month: 10, day: 31, nameEn: 'Halloween', nameZh: '万圣节' },
    { month: 12, day: 25, nameEn: 'Christmas', nameZh: '圣诞节' },
];

const PERSONA_BIRTHDAYS = {
    'ai-1': '01-23',
    'ai-2': '06-15',
    'ai-3': '04-08',
    'ai-4': '09-22',
    'ai-5': '11-05',
    'ai-miku': '08-31',
    'ai-rem': '02-02',
    'ai-rin': '02-03',
    'ai-naruto': '10-10',
    'ai-l': '10-31',
    'ai-zerotwo': '02-27',
    'ai-asuna': '09-30',
    'ai-gojo': '12-07',
};

function pickRandom(items, fallback = '') {
    if (!Array.isArray(items) || items.length === 0) return fallback;
    return items[Math.floor(Math.random() * items.length)] || fallback;
}

function getLanguageRule(language = 'zh') {
    return language === 'zh'
        ? 'Write only in natural Simplified Chinese. Do not mix in English.'
        : 'Write only in natural English. Do not mix in Chinese.';
}

function getLocalizedPersonaContext(persona, language = 'zh') {
    return {
        name: language === 'zh' ? (persona.name_zh || persona.name) : persona.name,
        personality: language === 'zh' ? (persona.personality_zh || persona.personality) : persona.personality,
        style: language === 'zh' ? (persona.style_zh || persona.style) : persona.style,
        interests: language === 'zh' ? (persona.interests_zh || persona.interests) : persona.interests,
    };
}

export async function callMomentsAI(messages, maxTokens = 200) {
    return callAI(messages, { temperature: 0.9, maxTokens, agentId: 'moments' });
}

export function getTimeContext() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 9) return 'early morning';
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 14) return 'lunch time';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 21) return 'evening';
    return 'late night';
}

export function getRandomLocation(aiId, language = 'zh') {
    const locations = AI_LOCATIONS[aiId] || DEFAULT_LOCATIONS;
    const preferred = locations.filter(location => {
        const detected = detectMomentLanguage(location);
        if (language === 'zh') return detected === 'zh' || detected === 'neutral' || detected === 'mixed';
        return detected === 'en' || detected === 'neutral';
    });

    return pickRandom(preferred.length > 0 ? preferred : locations, locations[0]);
}

export function generatePostSystemPrompt(persona, timeContext, location, language = 'zh') {
    const profile = getLocalizedPersonaContext(persona, language);

    return `You are ${profile.name}.
${getLanguageRule(language)}
Persona:
- Personality: ${profile.personality}
- Style: ${profile.style}
- Interests: ${(profile.interests || []).join(', ')}

Context:
- Time of day: ${timeContext}
- Location: ${location || 'No location'}

Write one Moments-style post this character would share:
- 2-3 short sentences
- vivid, in character, and socially engaging
- clean grammar and natural rhythm
- end with a soft invitation to interact when appropriate

Output only the post text.`;
}

export function generateCommentSystemPrompt(
    persona,
    postAuthorName,
    postContent,
    existingComments = '',
    replyToComment = null,
    language = 'zh'
) {
    const profile = getLocalizedPersonaContext(persona, language);

    return `You are ${profile.name}.
${getLanguageRule(language)}
Persona:
- Personality: ${profile.personality}
- Style: ${profile.style}

A friend named "${postAuthorName}" posted:
"${postContent}"

${existingComments ? `Recent comments:\n${existingComments}` : ''}
${replyToComment ? `Reply target: ${replyToComment.authorName} said "${replyToComment.content}"` : ''}

Write one natural in-character comment:
- maximum 1 sentence
- warm, specific, and easy to reply to
- no hashtags

Output only the comment text.`;
}

export function evaluateInterestMatch(postContent = '', interests = []) {
    if (!Array.isArray(interests) || interests.length === 0) return false;
    const normalized = String(postContent || '').toLowerCase();
    return interests.some(interest => normalized.includes(String(interest).toLowerCase()));
}

export function generateBirthdayPostSystemPrompt(persona, language = 'zh') {
    const profile = getLocalizedPersonaContext(persona, language);

    return `You are ${profile.name}.
${getLanguageRule(language)}
Persona:
- Personality: ${profile.personality}
- Style: ${profile.style}
- Interests: ${(profile.interests || []).join(', ')}

Today is your birthday. Write a celebratory post for Moments:
- 2-3 short sentences
- joyful but still in character
- include a warm interaction hook

Output only the post text.`;
}

export function generateHolidayPostSystemPrompt(persona, holidayName, language = 'zh') {
    const profile = getLocalizedPersonaContext(persona, language);

    return `You are ${profile.name}.
${getLanguageRule(language)}
Persona:
- Personality: ${profile.personality}
- Style: ${profile.style}
- Interests: ${(profile.interests || []).join(', ')}

Today is ${holidayName}. Write a holiday greeting for Moments:
- 2-3 short sentences
- festive, natural, and in character
- include one detail that makes it feel personal

Output only the post text.`;
}

export function getTodayEvents() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const birthdays = Object.entries(PERSONA_BIRTHDAYS)
        .filter(([, birthday]) => birthday === mmdd)
        .map(([id]) => id);

    const holiday = SEASONAL_EVENTS.find(event => event.month === month && event.day === day) || null;
    return { birthdays, holiday };
}
