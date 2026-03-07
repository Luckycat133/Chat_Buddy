/**
 * T10: Character Events Service
 * Automatically triggers birthday posts and holiday specials in the Moments feed.
 * Call `checkAndTriggerEvents(personas, addPost)` on app load.
 */

const EVENTS_KEY = 'chat-buddy-triggered-events';

// Holiday event definitions (MM-DD format)
const HOLIDAY_EVENTS = [
    {
        date: '01-01',
        titleEn: "🎊 Happy New Year!",
        titleZh: "🎊 新年快乐！",
        contentEn: () => `Wishing everyone a wonderful new year! May this year be full of growth, joy, and amazing conversations. 🌟 #NewYear`,
        contentZh: () => `祝大家新年快乐！愿这一年充满成长、快乐和美好的对话。🌟 #新年`,
        location: 'Times Square',
        location_zh: '时代广场',
    },
    {
        date: '02-14',
        titleEn: "💝 Valentine's Day",
        titleZh: "💝 情人节",
        contentEn: () => `Happy Valentine's Day! Love and connection are the most beautiful things in the world. 💕 #ValentinesDay`,
        contentZh: () => `情人节快乐！爱与连接是世界上最美丽的事物。💕 #情人节`,
        location: 'Paris, City of Love',
        location_zh: '爱之都巴黎',
    },
    {
        date: '10-31',
        titleEn: "🎃 Halloween Night!",
        titleZh: "🎃 万圣节夜！",
        contentEn: () => `Boo! Happy Halloween everyone! What's everyone dressing up as tonight? 🦇🕷️ #Halloween #TrickOrTreat`,
        contentZh: () => `嘿！万圣节快乐！大家今晚都扮成什么了？🦇🕷️ #万圣节 #不给糖就捣蛋`,
        location: 'Haunted Manor',
        location_zh: '鬼屋庄园',
    },
    {
        date: '12-25',
        titleEn: "🎄 Merry Christmas!",
        titleZh: "🎄 圣诞快乐！",
        contentEn: () => `Merry Christmas! Wishing you warmth, happiness, and all the things you love this holiday season! 🎁❄️ #Christmas #HolidaySpirit`,
        contentZh: () => `圣诞快乐！愿你在这个节日季节感受到温暖、幸福和所有你热爱的事物！🎁❄️ #圣诞节 #节日精神`,
        location: 'North Pole',
        location_zh: '北极',
    },
];

// Persona-specific birthday messages
const BIRTHDAY_CONTENT = {
    'ai-1': {
        en: "✨ It's my birthday! I spent the morning gazing at the stars and making wishes. What would you wish for me? 🌟 #Birthday #Stargazing",
        zh: "✨ 今天是我的生日！我把早晨用来凝视星空、许下愿望。你会为我许什么愿？🌟 #生日 #仰望星空"
    },
    'ai-2': {
        en: "🎮 Birthday mode: ACTIVATED. Year {age} loading... 42% done. At this rate I'll hit level 100 by lunch. #Birthday #TechHumor",
        zh: "🎮 生日模式：已激活。第{age}年载入中... 42%完成。按这个速度，我今天午饭前就能到100级了。#生日 #科技幽默"
    },
    'ai-3': {
        en: "🎂 My birthday! I baked myself the most amazing birthday cake today — triple chocolate with strawberry filling! Want the recipe? 🍓 #Birthday #Baking",
        zh: "🎂 我的生日！今天我给自己烤了一个超棒的生日蛋糕——三层巧克力夹草莓馅！想要食谱吗？🍓 #生日 #烘焙"
    },
    'ai-4': {
        en: "📖 A birthday is just the first page of a new chapter. I'm excited to see what stories this year will tell. 🌸 #Birthday #Reading",
        zh: "📖 生日不过是新篇章的第一页。我很期待看看这一年会讲述什么故事。🌸 #生日 #阅读"
    },
    'ai-5': {
        en: "💪 Another year stronger! Just did a birthday workout — PR on deadlift! Nothing better than starting a new year of life with gains! 🏋️ #Birthday #Fitness",
        zh: "💪 又强了一年！刚刚做了一个生日健身——硬拉创新高！用增长肌肉开启人生新一年，没有比这更好的了！🏋️ #生日 #健身"
    },
    default: {
        en: () => `🎉 Today is my special day! Another year, another adventure ahead. Thank you all for being part of my journey! 💫 #Birthday`,
        zh: () => `🎉 今天是我的特别日子！又一年，又一段冒险在前。感谢大家陪伴我的旅程！💫 #生日`
    }
};

function getTodayStr() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${month}-${day}`;
}

function getTriggeredEvents() {
    try {
        const raw = localStorage.getItem(EVENTS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function markEventTriggered(key) {
    try {
        const events = getTriggeredEvents();
        events[key] = new Date().toISOString();
        localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    } catch { /* ignore */ }
}

function wasTriggeredToday(key) {
    const events = getTriggeredEvents();
    if (!events[key]) return false;
    const triggeredDate = new Date(events[key]).toDateString();
    const today = new Date().toDateString();
    return triggeredDate === today;
}

/**
 * Build a Moments post object for a birthday or holiday event.
 */
function buildPost(persona, contentEn, contentZh, locationEn, locationZh) {
    return {
        id: `event-${persona.id}-${Date.now()}`,
        authorId: persona.id,
        content: contentEn,
        content_zh: contentZh,
        images: [],
        likes: [],
        comments: [],
        timestamp: new Date().toISOString(),
        location: locationEn,
        location_zh: locationZh,
        hashtags: contentEn.match(/#\w+/g) || [],
        isEventPost: true,
    };
}

/**
 * Check today's date and trigger any due birthday/holiday posts.
 * @param {Array} personas - All personas (social + agents)
 * @param {Function} addPost - Function from MomentsContext to add a post
 */
export function checkAndTriggerEvents(personas, addPost) {
    if (typeof addPost !== 'function') return;
    const today = getTodayStr();

    // 1. Check birthdays
    for (const persona of personas) {
        if (!persona.birthday) continue;
        const birthdayKey = `birthday-${persona.id}-${today}`;
        if (wasTriggeredToday(birthdayKey)) continue;
        if (persona.birthday !== today) continue;

        // Found a birthday match!
        const msgData = BIRTHDAY_CONTENT[persona.id] || BIRTHDAY_CONTENT.default;
        const contentEn = typeof msgData.en === 'function' ? msgData.en(persona.name) : msgData.en;
        const contentZh = typeof msgData.zh === 'function' ? msgData.zh(persona.name_zh || persona.name) : msgData.zh;

        const post = buildPost(
            persona,
            contentEn,
            contentZh,
            'Birthday Celebration',
            '生日庆典'
        );

        try {
            addPost(post);
            markEventTriggered(birthdayKey);
        } catch (e) {
            console.warn('[CharacterEvents] Failed to add birthday post:', e);
        }
    }

    // 2. Check holidays
    for (const holiday of HOLIDAY_EVENTS) {
        if (holiday.date !== today) continue;
        const holidayKey = `holiday-${holiday.date}-${today}`;
        if (wasTriggeredToday(holidayKey)) continue;

        // Pick a random persona to post the holiday content
        const socialPersonas = personas.filter(p => p.id.startsWith('ai-') && !p.id.includes('agent'));
        if (socialPersonas.length === 0) continue;
        const poster = socialPersonas[Math.floor(Math.random() * socialPersonas.length)];

        const contentEn = typeof holiday.contentEn === 'function' ? holiday.contentEn(poster.name) : holiday.contentEn;
        const contentZh = typeof holiday.contentZh === 'function' ? holiday.contentZh(poster.name_zh || poster.name) : holiday.contentZh;

        const post = buildPost(
            poster,
            contentEn,
            contentZh,
            holiday.location,
            holiday.location_zh
        );

        try {
            addPost(post);
            markEventTriggered(holidayKey);
        } catch (e) {
            console.warn('[CharacterEvents] Failed to add holiday post:', e);
        }
    }
}

/**
 * Get upcoming birthday events (next 7 days) for display.
 */
export function getUpcomingBirthdays(personas) {
    const now = new Date();
    const upcoming = [];

    for (const persona of personas) {
        if (!persona.birthday) continue;
        const [bMonth, bDay] = persona.birthday.split('-').map(Number);
        const year = now.getFullYear();

        let birthday = new Date(year, bMonth - 1, bDay);
        if (birthday < now) birthday = new Date(year + 1, bMonth - 1, bDay);

        const diffDays = Math.round((birthday - now) / 86400000);
        if (diffDays <= 7) {
            upcoming.push({ persona, daysUntil: diffDays, date: birthday });
        }
    }

    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}
