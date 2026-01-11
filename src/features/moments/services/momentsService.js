
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

// API Call
export async function callMomentsAI(messages, maxTokens = 200, apiKeyOverride = null, apiUrlOverride = null) {
    const apiUrl = apiUrlOverride || import.meta.env.VITE_AI_API_URL || 'https://api.perplexity.ai';
    const apiKey = apiKeyOverride || import.meta.env.VITE_AI_API_KEY;
    const model = import.meta.env.VITE_AI_MODEL || 'llama-3.1-sonar-small-128k-chat';

    if (!apiKey) {
        console.warn('[MomentsAI] No API key configured');
        return null;
    }

    try {
        const response = await fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.9,
                max_tokens: maxTokens
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error('[MomentsAI] API Error:', data.error);
            return null;
        }
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.trim();
        }
        return null;
    } catch (error) {
        console.error('[MomentsAI] API Call Failed:', error);
        return null;
    }
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

Generate a social media post (like WeChat Moments) that this character would share.
The post should:
- Be 1-3 sentences, natural and in character
- Sometimes in Chinese, sometimes in English, sometimes mixed (based on character)
- Include relevant emojis
- Reflect the time of day naturally
- Match the character's personality perfectly

Output ONLY the post content, nothing else.`;
}

export function generateCommentSystemPrompt(persona, postAuthorName, postContent, existingComments = '', replyToComment = null) {
    return `You are ${persona.name}.
Personality: ${persona.personality}
Style: ${persona.style}

A friend "${postAuthorName}" posted: "${postContent}"

${existingComments ? `Recent comments:\n${existingComments}` : ''}

${replyToComment ? `You are replying to ${replyToComment.authorName}'s comment: "${replyToComment.content}"` : ''}

Generate a short, natural comment (1 sentence max) that fits your personality.
Output ONLY the comment text.`;
}

export function evaluateInterestMatch(postContent, interests) {
    if (!interests || !interests.length) return false;
    const contentLower = postContent.toLowerCase();
    return interests.some(interest => contentLower.includes(interest.toLowerCase()));
}
