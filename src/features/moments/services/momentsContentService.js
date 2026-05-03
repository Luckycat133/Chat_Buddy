const ZH_CHAR_REGEX = /[\u3400-\u9fff]/g;
const EN_CHAR_REGEX = /[A-Za-z]/g;
const HASHTAG_REGEX = /#[\w\u3400-\u9fff-]+/g;

const TOPIC_LIBRARY = [
    {
        id: 'food',
        keywordsEn: ['coffee', 'bakery', 'croissant', 'cake', 'dessert', 'dinner', 'lunch', 'breakfast', 'meal', 'kitchen'],
        keywordsZh: ['咖啡', '烘焙', '面包', '蛋糕', '甜点', '午饭', '午餐', '早餐', '晚饭', '厨房', '好吃'],
        titleEn: 'Food Notes',
        titleZh: '今日食光',
        hookEn: 'Good food always makes the day slow down in the best way.',
        hookZh: '好吃的东西，总会让一天的节奏温柔下来。',
        promptEn: 'Describe one bite, one smell, and one tiny feeling.',
        promptZh: '写下一个味道、一个气味，再补上一点点心情。',
        commentEn: 'This made me instantly hungry in the nicest way.',
        commentZh: '这条看得人立刻饿了，而且还是开心的那种。',
        hashtagsEn: ['#FoodNotes', '#LittleTreat'],
        hashtagsZh: ['#今日食光', '#小满足时刻'],
    },
    {
        id: 'travel',
        keywordsEn: ['travel', 'trip', 'station', 'train', 'beach', 'mountain', 'sunset', 'city walk', 'journey'],
        keywordsZh: ['旅行', '出发', '车站', '海边', '山路', '日落', '散步', '风景', '路上'],
        titleEn: 'Tiny Journey',
        titleZh: '路上的小故事',
        hookEn: 'The best trips usually hide in the little details we almost missed.',
        hookZh: '旅途里最难忘的，往往是差点被忽略的小细节。',
        promptEn: 'Add one sensory detail and one line about how the place changed your mood.',
        promptZh: '补一个感官细节，再写一句这片风景怎么改变了你的心情。',
        commentEn: 'I can almost picture the air and the light from here.',
        commentZh: '光看文字就能想象到那里的空气和光线。',
        hashtagsEn: ['#TinyJourney', '#ViewOfTheDay'],
        hashtagsZh: ['#路上的小故事', '#今日风景'],
    },
    {
        id: 'wellbeing',
        keywordsEn: ['run', 'workout', 'gym', 'yoga', 'morning air', 'trail', 'wellness', 'walk'],
        keywordsZh: ['跑步', '锻炼', '健身', '瑜伽', '晨风', '山路', '散步', '呼吸', '治愈'],
        titleEn: 'Reset Moment',
        titleZh: '重启一下',
        hookEn: 'Sometimes a short reset is all the body and mind need.',
        hookZh: '有时候，身心想要的只是一个短短的重启。',
        promptEn: 'Mention what your body noticed first, then invite others to share their ritual.',
        promptZh: '先写身体最先感受到的东西，再留一个让人愿意接话的问题。',
        commentEn: 'This feels like the kind of post that gives people energy.',
        commentZh: '这条会让人隔着屏幕都跟着提起精神。',
        hashtagsEn: ['#ResetMoment', '#MoveABit'],
        hashtagsZh: ['#重启一下', '#动一动就会好'],
    },
    {
        id: 'creative',
        keywordsEn: ['music', 'song', 'concert', 'drawing', 'book', 'reading', 'coding', 'idea', 'studio'],
        keywordsZh: ['音乐', '歌', '演唱会', '画画', '看书', '阅读', '灵感', '代码', '创作'],
        titleEn: 'Creative Spark',
        titleZh: '灵感闪一下',
        hookEn: 'A small spark is usually enough to light up the whole evening.',
        hookZh: '一个小小的灵感火花，就足够点亮整个晚上。',
        promptEn: 'Turn the post into a tiny scene and let readers peek into your process.',
        promptZh: '把它写成一个小场景，让读的人也能看到你的创作过程。',
        commentEn: 'There is such a clear creative pulse in this one.',
        commentZh: '这条里面的创作感特别清晰，一下就能感受到。',
        hashtagsEn: ['#CreativeSpark', '#MadeToday'],
        hashtagsZh: ['#灵感闪一下', '#今天做了点什么'],
    },
    {
        id: 'daily-life',
        keywordsEn: ['today', 'home', 'desk', 'window', 'friend', 'weekend', 'afternoon', 'evening'],
        keywordsZh: ['今天', '家里', '桌边', '窗边', '朋友', '周末', '下午', '傍晚', '日常'],
        titleEn: 'Little Daily Scene',
        titleZh: '日常切片',
        hookEn: 'Ordinary moments become memorable when we tell them with a little care.',
        hookZh: '普通日常一旦被认真描述，也会变得很值得保存。',
        promptEn: 'Focus on one detail that made an ordinary moment feel special.',
        promptZh: '抓住一个小细节，让平常的一刻也有记忆点。',
        commentEn: 'The best thing about this post is how easy it is to relate to.',
        commentZh: '这条最妙的地方，是让人一下就能共情。',
        hashtagsEn: ['#LittleDailyScene', '#TodayInOneMoment'],
        hashtagsZh: ['#日常切片', '#把今天留住'],
    },
];

const TIME_OF_DAY_LABELS = {
    en: {
        'early morning': 'early morning',
        morning: 'this morning',
        'lunch time': 'lunchtime',
        afternoon: 'this afternoon',
        evening: 'this evening',
        'late night': 'late tonight',
    },
    zh: {
        'early morning': '清晨',
        morning: '今天上午',
        'lunch time': '午间',
        afternoon: '今天下午',
        evening: '今晚',
        'late night': '深夜',
    },
};

function unique(items) {
    return [...new Set(items.filter(Boolean))];
}

function pickRandom(items, fallback = '') {
    if (!Array.isArray(items) || items.length === 0) return fallback;
    return items[Math.floor(Math.random() * items.length)] || fallback;
}

function countMatches(text, regex) {
    return (text.match(regex) || []).length;
}

function normalizeHashtag(tag) {
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

function extractFirstMeaningfulLine(text, language) {
    if (!text) return '';
    const separators = language === 'zh' ? /[。！？\n]/ : /[.!?\n]/;
    return text.split(separators).map(segment => segment.trim()).find(Boolean) || text.trim();
}

function buildMoodQuestion(language, topic) {
    if (language === 'zh') {
        if (topic.id === 'food') return '你最近也有哪一口让自己立刻开心起来吗？';
        if (topic.id === 'travel') return '你最近看到过最想留下来的风景是什么？';
        if (topic.id === 'wellbeing') return '你最近让自己重新充满电的小习惯是什么？';
        if (topic.id === 'creative') return '你最近的灵感是在哪个瞬间突然冒出来的？';
        return '你今天有没有也想悄悄记下来的小瞬间？';
    }
    if (topic.id === 'food') return 'What little treat has been carrying you lately?';
    if (topic.id === 'travel') return 'What view have you wanted to keep lately?';
    if (topic.id === 'wellbeing') return 'What tiny ritual has been helping you reset?';
    if (topic.id === 'creative') return 'Where did your latest spark of inspiration come from?';
    return 'What is one small moment you would keep from today?';
}

function getTopicById(topicId) {
    return TOPIC_LIBRARY.find(topic => topic.id === topicId) || TOPIC_LIBRARY[TOPIC_LIBRARY.length - 1];
}

export function detectMomentLanguage(text = '') {
    const normalized = String(text || '').replace(HASHTAG_REGEX, '').trim();
    const zhCount = countMatches(normalized, ZH_CHAR_REGEX);
    const enCount = countMatches(normalized, EN_CHAR_REGEX);

    if (zhCount > 0 && enCount > 0) {
        const dominant = Math.max(zhCount, enCount);
        const weakest = Math.min(zhCount, enCount);
        return weakest / dominant > 0.2 ? 'mixed' : (zhCount > enCount ? 'zh' : 'en');
    }
    if (zhCount > 0) return 'zh';
    if (enCount > 0) return 'en';
    return 'neutral';
}

export function sanitizeMomentText(text = '', language = 'zh') {
    let normalized = String(text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!normalized) return '';

    if (language === 'zh') {
        normalized = normalized
            .replace(/\s*([，。！？；：])/g, '$1')
            .replace(/,/g, '，')
            .replace(/\./g, '。')
            .replace(/!/g, '！')
            .replace(/\?/g, '？')
            .replace(/;/g, '；')
            .replace(/:/g, '：')
            .replace(/([，。！？；：])([^\n])/g, '$1$2');
    } else {
        normalized = normalized
            .replace(/，/g, ',')
            .replace(/。/g, '.')
            .replace(/！/g, '!')
            .replace(/？/g, '?')
            .replace(/；/g, ';')
            .replace(/：/g, ':')
            .replace(/\s*([,.!?;:])\s*/g, '$1 ')
            .replace(/\s+\n/g, '\n')
            .replace(/\n\s+/g, '\n')
            .trim();
    }

    return normalized;
}

export function inferMomentTopics(text = '') {
    const normalized = String(text || '').toLowerCase();
    const original = String(text || '');

    const matches = TOPIC_LIBRARY.filter(topic => {
        const enMatch = topic.keywordsEn.some(keyword => normalized.includes(keyword));
        const zhMatch = topic.keywordsZh.some(keyword => original.includes(keyword));
        return enMatch || zhMatch;
    }).map(topic => topic.id);

    return matches.length > 0 ? unique(matches) : ['daily-life'];
}

export function normalizeGeneratedMomentText(text, language = 'zh', fallbackText = '') {
    const fallback = sanitizeMomentText(fallbackText, language);
    const normalized = sanitizeMomentText(text, language);

    if (!normalized) return fallback;

    const detected = detectMomentLanguage(normalized);
    const incompatible = (language === 'zh' && (detected === 'en' || detected === 'mixed'))
        || (language === 'en' && detected === 'zh');

    if (incompatible) return fallback;
    return normalized;
}

export function buildFallbackMomentPost({ persona, language = 'zh', timeContext = 'morning', location = '' }) {
    const topics = inferMomentTopics(
        language === 'zh'
            ? (persona?.interests_zh || []).join(' ')
            : (persona?.interests || []).join(' ')
    );
    const topic = getTopicById(topics[0]);
    const timeLabel = TIME_OF_DAY_LABELS[language]?.[timeContext] || (language === 'zh' ? '今天' : 'today');
    const interest = pickRandom(language === 'zh' ? persona?.interests_zh : persona?.interests, topic.titleEn);
    const locationLead = location
        ? (language === 'zh' ? `在${location}` : `at ${location}`)
        : (language === 'zh' ? '在路上' : 'along the way');

    if (language === 'zh') {
        return sanitizeMomentText(
            `${timeLabel}${locationLead}，${interest || '这一刻'}忽然变得很值得记录。${topic.hookZh}${pickRandom([
                '想把这点小开心留给今天的自己。',
                '先认真记下来，晚点再回头看一定还会喜欢。',
                '这样的瞬间不发出来，好像会有点可惜。',
            ])}`,
            language
        );
    }

    return sanitizeMomentText(
        `${timeLabel} ${locationLead}, ${interest || 'this little scene'} felt worth keeping. ${topic.hookEn} ${pickRandom([
            'Saving it here before the feeling fades.',
            'Posting it before the moment gets folded back into the day.',
            'This one felt too soft and specific to let go.',
        ])}`,
        language
    );
}

export function buildFallbackMomentComment({
    persona,
    language = 'zh',
    postAuthorName,
    postContent = '',
    replyToComment = null,
}) {
    const topic = getTopicById(inferMomentTopics(postContent)[0]);
    const personaName = language === 'zh' ? (persona?.name_zh || persona?.name || 'AI') : (persona?.name || 'AI');

    if (language === 'zh') {
        const prefix = replyToComment
            ? `${personaName}看到这里也想接一句：`
            : `${postAuthorName || '你'}这条很有画面感，`;
        return sanitizeMomentText(`${prefix}${pickRandom([
            topic.commentZh,
            '读完会让人想把这一刻也多停留一会儿。',
            '这份氛围感写得很完整，一下就能代入进去。',
        ])}`, language);
    }

    const prefix = replyToComment
        ? `${personaName} had to jump in here: `
        : `${postAuthorName || 'You'} really captured the scene here. `;

    return sanitizeMomentText(`${prefix}${pickRandom([
        topic.commentEn,
        'It lands with a lot of warmth and detail.',
        'This feels easy to picture in the best possible way.',
    ])}`, language);
}

export function evaluateMomentDraft(content, language = 'zh') {
    const normalized = sanitizeMomentText(content, language);
    const detectedLanguage = detectMomentLanguage(normalized);
    const sentenceCount = normalized
        ? normalized.split(language === 'zh' ? /[。！？]/ : /[.!?]/).map(segment => segment.trim()).filter(Boolean).length
        : 0;
    const hasQuestion = language === 'zh' ? /[？]/.test(normalized) : /[?]/.test(normalized);

    return [
        {
            id: 'language',
            label: language === 'zh' ? '语言统一' : 'Language',
            status: detectedLanguage === 'mixed' ? 'warning' : (normalized ? 'good' : 'idle'),
            detail: detectedLanguage === 'mixed'
                ? (language === 'zh' ? '当前文案有中英文混杂，建议统一成一种语言。' : 'The draft still mixes languages. It will read better in one voice.')
                : (language === 'zh' ? '语言风格已经比较统一。' : 'The draft is staying in one language cleanly.'),
        },
        {
            id: 'story',
            label: language === 'zh' ? '故事感' : 'Story arc',
            status: sentenceCount >= 2 ? 'good' : (normalized ? 'warning' : 'idle'),
            detail: sentenceCount >= 2
                ? (language === 'zh' ? '已经有场景和情绪层次。' : 'There is enough scene and movement to feel like a story.')
                : (language === 'zh' ? '再补一个细节或感受，会更像故事。' : 'Add one detail or feeling to give it more narrative shape.'),
        },
        {
            id: 'interaction',
            label: language === 'zh' ? '互动引导' : 'Conversation hook',
            status: hasQuestion ? 'good' : (normalized ? 'tip' : 'idle'),
            detail: hasQuestion
                ? (language === 'zh' ? '结尾已经给评论区留了接话口。' : 'The ending already invites people to respond.')
                : (language === 'zh' ? '结尾加一个问题，互动率通常会更高。' : 'A closing question usually helps people jump into the comments.'),
        },
    ];
}

function buildHashtags(topic, language, content) {
    const presetTags = language === 'zh' ? topic.hashtagsZh : topic.hashtagsEn;
    const existing = unique((content.match(HASHTAG_REGEX) || []).map(normalizeHashtag));
    const merged = unique([...existing, ...presetTags.map(normalizeHashtag)]);
    return merged.slice(0, 3);
}

export function createLocalWritingAssist({ content = '', language = 'zh', location = '' }) {
    const normalized = sanitizeMomentText(content, language);
    const topic = getTopicById(inferMomentTopics(normalized)[0]);
    const firstLine = extractFirstMeaningfulLine(normalized, language);
    const quality = evaluateMomentDraft(normalized, language);
    const baseLine = firstLine || (language === 'zh' ? '想发一条有画面感的动态。' : 'I want to share a warm moment from today.');
    const locationLead = location
        ? (language === 'zh' ? `在${location}` : `At ${location}`)
        : (language === 'zh' ? '刚刚' : 'Just now');
    const reflection = language === 'zh'
        ? pickRandom([
            `${topic.hookZh}`,
            '这种普通又具体的瞬间，最适合留下来。',
            '越是小小的片段，越容易在后来想起。',
        ])
        : pickRandom([
            `${topic.hookEn}`,
            'Small moments like this usually stay the longest.',
            'These ordinary details are often the ones we keep.',
        ]);
    const question = buildMoodQuestion(language, topic);

    const polishedContent = language === 'zh'
        ? sanitizeMomentText(`${locationLead}，${baseLine}${/[。！？]$/.test(baseLine) ? '' : '。'}${reflection}${question}`, language)
        : sanitizeMomentText(`${locationLead}, ${baseLine}${/[.!?]$/.test(baseLine) ? '' : '.'} ${reflection} ${question}`, language);

    const title = language === 'zh'
        ? `${topic.titleZh}${location ? ` · ${location}` : ''}`
        : `${topic.titleEn}${location ? ` · ${location}` : ''}`;

    return {
        title,
        polishedContent,
        hashtags: buildHashtags(topic, language, normalized),
        suggestions: language === 'zh'
            ? [
                '把最有画面感的那个动作写出来，读感会更鲜活。',
                '如果有气味、温度或声音，补一个进去会更有代入感。',
                '最后留一个轻一点的问题，评论区更容易接上。',
            ]
            : [
                'Name the one visual detail that makes the scene feel real.',
                'Add one sensory cue like sound, temperature, or smell.',
                'Leave a light question at the end to invite replies.',
            ],
        quality,
    };
}

function extractJsonObject(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return trimmed;
    }

    const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) return fencedMatch[1].trim();

    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    return objectMatch?.[0] || null;
}

export function parseMomentAssistResponse(raw, language = 'zh', fallback = null) {
    const fallbackAssist = fallback || createLocalWritingAssist({ content: '', language });
    const jsonCandidate = extractJsonObject(raw);

    if (!jsonCandidate) return fallbackAssist;

    try {
        const parsed = JSON.parse(jsonCandidate);
        const polishedContent = normalizeGeneratedMomentText(
            parsed.polishedContent,
            language,
            fallbackAssist.polishedContent
        );
        const hashtags = unique((parsed.hashtags || []).map(normalizeHashtag)).slice(0, 3);
        const suggestions = Array.isArray(parsed.suggestions)
            ? parsed.suggestions.filter(item => typeof item === 'string' && item.trim()).slice(0, 3)
            : fallbackAssist.suggestions;

        return {
            title: sanitizeMomentText(parsed.title || fallbackAssist.title, language),
            polishedContent,
            hashtags: hashtags.length > 0 ? hashtags : fallbackAssist.hashtags,
            suggestions,
            quality: fallbackAssist.quality,
        };
    } catch (e) {
        console.warn('[momentsContent] Assist parsing failed:', e?.message);
        return fallbackAssist;
    }
}

export function buildMomentWritingAssistPrompt(language = 'zh') {
    const languageRule = language === 'zh'
        ? 'Use only natural Simplified Chinese. Do not mix English.'
        : 'Use only natural English. Do not mix Chinese.';

    return `${languageRule}
You are a social media writing coach improving a short Moments-style post.
Return strict JSON with this exact shape:
{
  "title": "short headline",
  "polishedContent": "2-3 sentence post",
  "hashtags": ["#tag1", "#tag2"],
  "suggestions": ["tip 1", "tip 2", "tip 3"]
}
Make the text smoother, more story-driven, and more likely to invite comments.`;
}

export function buildMomentFeedbackPrompt(language = 'zh', authorName = '') {
    const languageRule = language === 'zh'
        ? 'Use only natural Simplified Chinese. Do not mix English.'
        : 'Use only natural English. Do not mix Chinese.';

    return `${languageRule}
You are a thoughtful AI companion giving feedback on a Moments post by ${authorName || 'the user'}.
Return strict JSON with this exact shape:
{
  "summary": "one sentence on what works",
  "nextMove": "one practical improvement",
  "suggestedComment": "one warm smart comment"
}`;
}

export function buildLocalMomentFeedback(post, language = 'zh') {
    const topic = getTopicById(inferMomentTopics(post?.content || '')[0]);

    if (language === 'zh') {
        return {
            summary: `这条动态最抓人的地方，是把“${topic.titleZh}”写成了一个能看见、能感受到的小场景。`,
            nextMove: '如果下一条再补一个更具体的动作或声音，故事感会更完整。',
            suggestedComment: pickRandom([
                topic.commentZh,
                '这一句里有很强的画面感，读完会想在原地多停一会儿。',
                '这条很适合继续展开成一个更长的小故事。',
            ]),
        };
    }

    return {
        summary: `What works best here is how "${topic.titleEn}" turns into a scene people can actually picture.`,
        nextMove: 'If you add one more concrete motion or sound next time, the story will land even harder.',
        suggestedComment: pickRandom([
            topic.commentEn,
            'The scene feels vivid without trying too hard.',
            'This could easily turn into an even richer follow-up post.',
        ]),
    };
}

export function buildPersonalizedMomentRecommendations(posts = [], language = 'zh') {
    const recentPosts = posts.slice(0, 12);
    const dominantTopic = getTopicById(
        inferMomentTopics(recentPosts.map(post => post.content || '').join(' '))[0]
    );

    if (language === 'zh') {
        return [
            {
                id: 'scene',
                title: '写一个小场景',
                prompt: '把刚才最想留下来的那个 10 秒钟写下来，重点写画面和情绪。',
            },
            {
                id: 'follow-up',
                title: `继续你的${dominantTopic.titleZh}`,
                prompt: `${dominantTopic.promptZh} 末尾再留一句轻一点的提问。`,
            },
            {
                id: 'conversation',
                title: '给评论区留入口',
                prompt: '先写今天的一个细节，最后问大家最近有没有类似的小瞬间。',
            },
        ];
    }

    return [
        {
            id: 'scene',
            title: 'Turn it into a scene',
            prompt: 'Write the one 10-second moment you want to keep, then add the feeling under it.',
        },
        {
            id: 'follow-up',
            title: `Build on ${dominantTopic.titleEn}`,
            prompt: `${dominantTopic.promptEn} Finish with a gentle question people can answer quickly.`,
        },
        {
            id: 'conversation',
            title: 'Open the comments',
            prompt: 'Share one detail from today and end by asking what tiny moment stayed with everyone else.',
        },
    ];
}

export function buildCommentSuggestions(post, language = 'zh') {
    const topic = getTopicById(inferMomentTopics(post?.content || '')[0]);

    if (language === 'zh') {
        return unique([
            topic.commentZh,
            '这句写得很有画面感，我一下就代入进去了。',
            buildMoodQuestion(language, topic),
        ]).slice(0, 3);
    }

    return unique([
        topic.commentEn,
        'This is such an easy scene to picture.',
        buildMoodQuestion(language, topic),
    ]).slice(0, 3);
}
