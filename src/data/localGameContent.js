/**
 * Local game content keeps casual games instant and provider-free.
 * The exported helpers accept an optional RNG so tests can be deterministic.
 */

const QUIZ_CATEGORIES = {
    general: ['General Knowledge', '常识'],
    science: ['Science', '科学'],
    history: ['History', '历史'],
    culture: ['Pop Culture', '流行文化'],
    technology: ['Technology', '科技'],
    math: ['Math', '数学'],
};

const q = (questionZh, optionsZh, correct, explanationZh, questionEn, optionsEn, explanationEn) => ({
    zh: { question: questionZh, options: optionsZh, correct, explanation: explanationZh },
    en: { question: questionEn, options: optionsEn, correct, explanation: explanationEn },
});

const QUIZ_BANK = {
    general: [
        q('世界上面积最大的海洋是？', ['太平洋', '大西洋', '印度洋', '北冰洋'], 0, '太平洋约占全球海洋面积的一半。', 'Which is the largest ocean?', ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'], 'The Pacific covers roughly half of the world ocean.'),
        q('一年通常有多少天？', ['360', '365', '366', '370'], 1, '平年有 365 天，闰年有 366 天。', 'How many days are in a common year?', ['360', '365', '366', '370'], 'A common year has 365 days; a leap year has 366.'),
        q('奥林匹克五环共有几种颜色？', ['4', '5', '6', '7'], 1, '五环分别为蓝、黄、黑、绿、红。', 'How many colors are used for the Olympic rings?', ['4', '5', '6', '7'], 'The rings are blue, yellow, black, green, and red.'),
        q('“世界屋脊”通常指哪里？', ['青藏高原', '亚马孙平原', '东非高原', '阿尔卑斯山'], 0, '青藏高原平均海拔很高，因此被称为世界屋脊。', 'Which region is often called the “Roof of the World”?', ['Tibetan Plateau', 'Amazon Basin', 'East African Plateau', 'Alps'], 'The Tibetan Plateau is known for its exceptionally high average elevation.'),
        q('指南针的红色指针通常指向哪个方向？', ['东', '南', '西', '北'], 3, '常见指南针的红色端标示磁北方向。', 'Which direction does the red end of a typical compass needle indicate?', ['East', 'South', 'West', 'North'], 'The red end conventionally indicates magnetic north.'),
    ],
    science: [
        q('水在标准大气压下的沸点是？', ['0°C', '50°C', '100°C', '120°C'], 2, '在一个标准大气压下，水约在 100°C 沸腾。', 'What is the boiling point of water at standard pressure?', ['0°C', '50°C', '100°C', '120°C'], 'At one standard atmosphere, water boils at about 100°C.'),
        q('植物进行光合作用主要吸收什么气体？', ['氧气', '二氧化碳', '氮气', '氢气'], 1, '植物吸收二氧化碳并释放氧气。', 'Which gas do plants mainly absorb for photosynthesis?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 'Plants absorb carbon dioxide and release oxygen.'),
        q('人体最大的器官是？', ['心脏', '肝脏', '皮肤', '肺'], 2, '皮肤覆盖全身，是人体最大的器官。', 'What is the largest organ of the human body?', ['Heart', 'Liver', 'Skin', 'Lungs'], 'Skin covers the body and is its largest organ.'),
        q('太阳系中离太阳最近的行星是？', ['金星', '地球', '水星', '火星'], 2, '水星的轨道最靠近太阳。', 'Which planet is closest to the Sun?', ['Venus', 'Earth', 'Mercury', 'Mars'], 'Mercury has the innermost orbit.'),
        q('声音不能在哪种环境中传播？', ['空气', '水', '钢铁', '真空'], 3, '声音需要介质，真空中没有可传递振动的介质。', 'In which environment can sound not travel?', ['Air', 'Water', 'Steel', 'Vacuum'], 'Sound needs a medium, which a vacuum lacks.'),
    ],
    history: [
        q('中国古代四大发明不包括哪一项？', ['造纸术', '指南针', '火药', '蒸汽机'], 3, '蒸汽机不是中国古代四大发明之一。', 'Which was not one of ancient China’s Four Great Inventions?', ['Papermaking', 'Compass', 'Gunpowder', 'Steam engine'], 'The steam engine was not among the Four Great Inventions.'),
        q('古埃及文明主要发源于哪条河流域？', ['尼罗河', '恒河', '多瑙河', '密西西比河'], 0, '尼罗河的周期性泛滥支撑了古埃及农业。', 'Ancient Egyptian civilization developed mainly along which river?', ['Nile', 'Ganges', 'Danube', 'Mississippi'], 'The Nile’s regular flooding supported Egyptian agriculture.'),
        q('文艺复兴最早兴起于哪个国家？', ['法国', '意大利', '英国', '德国'], 1, '文艺复兴在意大利城邦率先兴起。', 'In which country did the Renaissance begin?', ['France', 'Italy', 'England', 'Germany'], 'It began in the Italian city-states.'),
        q('人类首次登月发生在哪一年？', ['1957', '1961', '1969', '1975'], 2, '阿波罗 11 号于 1969 年完成人类首次登月。', 'In which year did humans first land on the Moon?', ['1957', '1961', '1969', '1975'], 'Apollo 11 completed the first crewed Moon landing in 1969.'),
        q('丝绸之路主要连接古代中国与哪个方向的地区？', ['欧洲和西亚', '南极洲', '澳大利亚', '北美洲'], 0, '陆上丝绸之路沟通了东亚、中亚、西亚与欧洲。', 'The Silk Road mainly connected ancient China with which regions?', ['West Asia and Europe', 'Antarctica', 'Australia', 'North America'], 'Its routes linked East Asia with Central Asia, West Asia, and Europe.'),
    ],
    culture: [
        q('电影通常以什么单位衡量播放时长？', ['公里', '分钟', '升', '摄氏度'], 1, '电影时长通常用分钟表示。', 'Which unit commonly measures a film’s running time?', ['Kilometers', 'Minutes', 'Liters', 'Degrees Celsius'], 'Running time is commonly expressed in minutes.'),
        q('交响乐团中通常负责统一节奏和演奏的是？', ['编剧', '指挥', '剪辑师', '摄影师'], 1, '指挥通过手势协调乐团的速度、力度与进入时机。', 'Who coordinates the tempo and entries of an orchestra?', ['Screenwriter', 'Conductor', 'Editor', 'Cinematographer'], 'The conductor coordinates tempo, dynamics, and entries.'),
        q('漫画连续画面之间的空白通常称为什么？', ['分镜间隙', '片尾字幕', '音轨', '焦距'], 0, '画格之间的间隙帮助读者感知时间与动作跳转。', 'What is the space between comic panels commonly called?', ['Gutter', 'Credits', 'Soundtrack', 'Focal length'], 'The gutter helps readers infer movement and elapsed time.'),
        q('一张音乐专辑通常由什么组成？', ['多首歌曲或乐曲', '一幅地图', '一段代码', '一组公式'], 0, '专辑是按一定主题或顺序组织的音乐作品集合。', 'What does a music album usually contain?', ['A collection of tracks', 'A map', 'A code file', 'A set of equations'], 'An album is an organized collection of musical tracks.'),
        q('动画中的“帧”指什么？', ['单幅画面', '音量大小', '影院座位', '剧本章节'], 0, '连续快速播放单幅画面会形成运动感。', 'What is a “frame” in animation?', ['A single image', 'Volume level', 'Cinema seat', 'Script chapter'], 'Rapidly displaying individual frames creates the illusion of motion.'),
    ],
    technology: [
        q('HTTP 主要用于什么？', ['传输网页资源', '测量温度', '存储纸张', '调节音高'], 0, 'HTTP 是客户端与服务器传输 Web 资源的应用层协议。', 'What is HTTP mainly used for?', ['Transferring web resources', 'Measuring temperature', 'Storing paper', 'Tuning pitch'], 'HTTP is an application protocol for transferring web resources.'),
        q('二进制系统只使用哪两个数字？', ['0 和 1', '1 和 2', '2 和 3', '8 和 9'], 0, '二进制的每一位只有 0 或 1 两种状态。', 'Which two digits does binary use?', ['0 and 1', '1 and 2', '2 and 3', '8 and 9'], 'Each binary digit has only the state 0 or 1.'),
        q('“开源软件”通常意味着什么？', ['源代码可按许可证查看和修改', '只能离线使用', '没有用户界面', '必须收费'], 0, '开源许可证规定了查看、修改和分发源代码的权利。', 'What does “open-source software” generally mean?', ['Its source can be viewed and modified under a license', 'It only works offline', 'It has no interface', 'It must be paid'], 'An open-source license defines rights to inspect, modify, and distribute code.'),
        q('数据库索引的主要用途是？', ['加快数据查找', '增加屏幕亮度', '压缩图片颜色', '替换操作系统'], 0, '索引以额外存储换取更快的查询定位。', 'What is the main purpose of a database index?', ['Speeding up lookups', 'Increasing screen brightness', 'Reducing image colors', 'Replacing the operating system'], 'Indexes trade some storage and write cost for faster lookup.'),
        q('多因素认证比单一密码多了什么？', ['额外的身份验证因素', '更大的显示器', '更多文件夹', '更长的用户名'], 0, '它要求来自不同类别的两个或更多验证因素。', 'What does multi-factor authentication add beyond a password?', ['Another authentication factor', 'A larger monitor', 'More folders', 'A longer username'], 'It requires two or more factors from different authentication categories.'),
    ],
    math: [
        q('3 × 7 等于多少？', ['10', '18', '21', '24'], 2, '3 组 7 相加得到 21。', 'What is 3 × 7?', ['10', '18', '21', '24'], 'Three groups of seven equal 21.'),
        q('一个正方形有几条边？', ['3', '4', '5', '6'], 1, '正方形有四条等长的边。', 'How many sides does a square have?', ['3', '4', '5', '6'], 'A square has four equal sides.'),
        q('50 的 20% 是多少？', ['5', '10', '15', '20'], 1, '50 × 0.2 = 10。', 'What is 20% of 50?', ['5', '10', '15', '20'], '50 × 0.2 = 10.'),
        q('数列 2、4、6、8 的下一个数是？', ['9', '10', '11', '12'], 1, '这是每次增加 2 的等差数列。', 'What comes next: 2, 4, 6, 8?', ['9', '10', '11', '12'], 'The sequence increases by 2 each time.'),
        q('三角形内角和是多少度？', ['90°', '180°', '270°', '360°'], 1, '欧氏平面中三角形内角和为 180°。', 'What is the sum of a triangle’s interior angles in Euclidean geometry?', ['90°', '180°', '270°', '360°'], 'The interior angles sum to 180°.'),
    ],
};

function categoryKey(category) {
    return Object.entries(QUIZ_CATEGORIES).find(([, labels]) => labels.includes(category))?.[0] || 'general';
}

function shuffled(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function getLocalQuizQuestions(category, language = 'zh', count = 5, random = Math.random) {
    const locale = language === 'en' ? 'en' : 'zh';
    return shuffled(QUIZ_BANK[categoryKey(category)], random)
        .slice(0, Math.max(1, Math.min(count, 5)))
        .map(item => ({ ...item[locale], options: [...item[locale].options] }));
}

const IDIOMS = [
    ['一石二鸟', '做一件事同时达到两个目的'], ['鸟语花香', '鸟鸣悦耳，花香扑鼻'],
    ['香气袭人', '香味迎面而来'], ['人山人海', '聚集的人非常多'],
    ['海阔天空', '天地广阔，也比喻想象不受拘束'], ['空前绝后', '前所未有，后世也难再有'],
    ['后来居上', '后起者超过先行者'], ['上善若水', '最高的善如水一样泽被万物'],
    ['水到渠成', '条件成熟，事情自然成功'], ['成千上万', '数量非常多'],
    ['万事如意', '一切事情都符合心愿'], ['意气风发', '精神振奋，气概豪迈'],
    ['发扬光大', '使优良传统得到发展提高'], ['大功告成', '重大工程或任务完成'],
    ['成竹在胸', '处理事情前已有完整打算'], ['胸有成竹', '做事前已有成熟计划'],
    ['竹报平安', '报来平安的消息'], ['安居乐业', '生活安定并愉快工作'],
    ['业精于勤', '学业因勤奋而精通'], ['勤能补拙', '勤奋可以弥补天资不足'],
    ['马到成功', '事情迅速取得成功'], ['功成名就', '功业建立，名声取得'],
    ['就事论事', '只按事情本身评论'], ['事半功倍', '用较少力气取得较大效果'],
    ['倍道而行', '加快速度赶路'], ['行云流水', '自然流畅，不受拘束'],
    ['水滴石穿', '坚持不懈，力量虽小也能成功'], ['穿针引线', '从中联系撮合'],
    ['半途而废', '事情没有完成就停止'], ['废寝忘食', '专心努力，顾不上睡觉吃饭'],
    ['食指大动', '面对美食产生强烈食欲'], ['动人心弦', '非常感动人'],
    ['弦外之音', '话语中间接透露的意思'], ['音容笑貌', '对故人声音容貌的回忆'],
    ['守株待兔', '不主动努力而希望侥幸获益'], ['兔死狐悲', '因同类遭遇而感到悲伤'],
    ['悲喜交加', '悲伤和喜悦交织在一起'], ['加官进爵', '职位提升，爵位晋升'],
    ['对牛弹琴', '对不懂道理的人讲深奥道理'], ['琴棋书画', '弹琴、弈棋、书法、绘画等才艺'],
    ['画蛇添足', '做多余的事反而弄巧成拙'], ['足智多谋', '富有智慧，善于谋划'],
    ['谋事在人', '事情的谋划取决于人的努力'], ['四面楚歌', '陷入孤立无援的境地'],
    ['歌舞升平', '唱歌跳舞庆祝太平'], ['平易近人', '态度谦逊，使人容易接近'],
    ['亡羊补牢', '出了问题及时补救仍不算晚'], ['牢不可破', '坚固得无法摧毁'],
    ['破釜沉舟', '下定决心，不留退路'], ['舟车劳顿', '旅途奔波劳累'],
    ['顿开茅塞', '一下子理解了困惑的问题'], ['塞翁失马', '坏事可能转化为好事'],
    ['一心一意', '心思专一，没有别的念头'], ['百花齐放', '各种不同形式自由发展'],
    ['放虎归山', '把敌人放回去留下后患'], ['山高水长', '品德高尚，影响深远'],
    ['长年累月', '经过很长时间'], ['月明星稀', '月光明亮时星星显得稀少'],
    ['稀世之宝', '世间罕见的珍宝'], ['宝刀未老', '年纪虽大，本领仍在'],
    ['老马识途', '有经验的人熟悉情况'], ['专心致志', '心意专一，精神集中'],
    ['志同道合', '志向相同，观点相合'], ['合情合理', '符合情理'],
    ['理直气壮', '理由充分，说话有气势'], ['壮志凌云', '志向宏伟远大'],
    ['云开见日', '困难消除，重新见到光明'], ['日新月异', '每天每月都有新变化'],
    ['异想天开', '想法非常奇特'], ['开门见山', '说话写文章直截了当'],
];

const IDIOM_MAP = new Map(IDIOMS);
const SEED_IDIOMS = ['一石二鸟', '马到成功', '半途而废', '守株待兔', '对牛弹琴', '四面楚歌', '亡羊补牢', '一心一意'];

export function isKnownIdiom(text) {
    return IDIOM_MAP.has(String(text || '').trim());
}

export function getIdiomMeaning(text) {
    return IDIOM_MAP.get(String(text || '').trim()) || '';
}

export function findNextIdiom(lastIdiom, used = [], random = Math.random) {
    const lastChar = String(lastIdiom || '').trim().slice(-1);
    if (!lastChar) return null;
    const excluded = new Set(used);
    const candidates = IDIOMS.map(([idiom]) => idiom)
        .filter(idiom => idiom.startsWith(lastChar) && !excluded.has(idiom));
    if (candidates.length === 0) return null;
    return candidates[Math.floor(random() * candidates.length)];
}

export function getRandomSeedIdiom(random = Math.random) {
    return SEED_IDIOMS[Math.floor(random() * SEED_IDIOMS.length)];
}
