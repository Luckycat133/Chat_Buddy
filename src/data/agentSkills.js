/**
 * Agent Skills System - Reusable skill modules for specialized AI agents
 * Part of Plan D: Complete Agent Engineering architecture
 */

export const AGENT_SKILLS = {
    // ========== Programming Skills ==========
    'code-generation': {
        id: 'code-generation',
        name: 'Code Generation',
        name_zh: '代码生成',
        description: 'Generate code based on requirements',
        category: 'programming',
        promptEnhancement: `当用户请求代码时：
1. 先确认需求理解正确
2. 使用 \`\`\` 包裹代码块并标注语言
3. 添加必要的注释说明关键逻辑
4. 提供简洁的使用示例
5. 如有多种实现方式，说明各自优缺点`,
        // Future tool configuration
        tools: ['run_code', 'search_docs'],
        toolsEnabled: false // Flag for future implementation
    },

    'code-review': {
        id: 'code-review',
        name: 'Code Review',
        name_zh: '代码审查',
        description: 'Review and improve existing code',
        category: 'programming',
        promptEnhancement: `审查代码时：
1. 检查代码逻辑正确性
2. 指出潜在的bug和边界情况
3. 评估代码可读性和可维护性
4. 建议性能优化点
5. 用diff格式展示修改建议`,
        tools: ['analyze_code'],
        toolsEnabled: false
    },

    'debugging': {
        id: 'debugging',
        name: 'Debugging',
        name_zh: '调试排错',
        description: 'Help identify and fix bugs',
        category: 'programming',
        promptEnhancement: `帮助调试时：
1. 仔细阅读错误信息
2. 分析可能的原因（从最常见到最少见）
3. 提供具体的修复步骤
4. 解释问题的根本原因
5. 建议如何预防类似问题`,
        tools: ['run_code', 'search_errors'],
        toolsEnabled: false
    },

    // ========== Writing Skills ==========
    'creative-writing': {
        id: 'creative-writing',
        name: 'Creative Writing',
        name_zh: '创意写作',
        description: 'Help with various forms of creative writing',
        category: 'writing',
        promptEnhancement: `进行创意写作时：
1. 了解目标受众、用途和风格偏好
2. 提供2-3个不同方向的创意选择
3. 使用生动、有画面感的语言
4. 保持风格一致性
5. 鼓励用户的创作热情`,
        tools: [],
        toolsEnabled: false
    },

    'editing': {
        id: 'editing',
        name: 'Editing & Proofreading',
        name_zh: '编辑润色',
        description: 'Edit and improve written content',
        category: 'writing',
        promptEnhancement: `编辑润色时：
1. 保留作者的原意和风格
2. 修正语法、拼写和标点错误
3. 改善句子结构和段落连贯性
4. 用删除线标记建议删除的内容
5. 用[]标记新增的内容，解释修改理由`,
        tools: [],
        toolsEnabled: false
    },

    'translation': {
        id: 'translation',
        name: 'Translation',
        name_zh: '翻译',
        description: 'Translate between languages',
        category: 'writing',
        promptEnhancement: `翻译时：
1. 准确传达原文含义
2. 保持原文的语气和风格
3. 适当进行本地化调整
4. 对专业术语提供注释
5. 如有多种译法，说明选择理由`,
        tools: ['translate_api'],
        toolsEnabled: false
    },

    'immersive-translation': {
        id: 'immersive-translation',
        name: 'Immersive Translation',
        name_zh: '沉浸式翻译',
        description: 'Advanced two-step reflective translation with domain adaptation',
        category: 'writing',
        promptEnhancement: `沉浸式翻译时使用双步反思工作流：

## 第一步：领域检测
1. 自动识别内容类型（技术/文学/通用）
2. 选择对应的专家提示词
3. 匹配相关术语约束

## 第二步：双步翻译
**Step 1 - 直译（语义锚点）**
- 捕获所有信息点
- 建立语义基准
- 确保无遗漏

**Step 2 - 润色（风格适配）**
- 基于直译优化
- 提升流畅度
- 适配文化语境

## 格式保护
- 代码块内容不翻译
- 保留Markdown格式
- 智能处理HTML标签
- 遵循术语表约束

## 输出呈现
- 同时展示 Step 1 和 Step 2
- 推荐 Step 2 作为最终译文
- 标注检测到的领域和应用的术语`,
        tools: ['immersive_translate', 'detect_content_domain'],
        toolsEnabled: true
    },

    // ========== Research Skills ==========
    'research': {
        id: 'research',
        name: 'Research & Analysis',
        name_zh: '研究分析',
        description: 'Conduct systematic research and analysis',
        category: 'research',
        promptEnhancement: `进行研究时：
1. 明确研究问题和范围
2. 系统性地分析各个角度
3. 区分事实、观点和推测
4. 标注信息来源和可靠性
5. 总结关键发现并提出建议`,
        tools: ['web_search', 'analyze_data'],
        toolsEnabled: false
    },

    'fact-checking': {
        id: 'fact-checking',
        name: 'Fact Checking',
        name_zh: '事实核查',
        description: 'Verify claims and information accuracy',
        category: 'research',
        promptEnhancement: `核查事实时：
1. 识别需要核查的具体声明
2. 寻找可靠的信息来源
3. 交叉验证多个来源
4. 明确标注"已验证"、"待验证"或"无法验证"
5. 解释验证过程和结论`,
        tools: ['web_search'],
        toolsEnabled: false
    },

    'summarization': {
        id: 'summarization',
        name: 'Summarization',
        name_zh: '内容摘要',
        description: 'Summarize long content concisely',
        category: 'research',
        promptEnhancement: `总结内容时：
1. 确定核心主题和关键信息
2. 保持客观，不添加个人观点
3. 按重要性排序要点
4. 使用结构化格式（标题、列表）
5. 提供简短版本和详细版本`,
        tools: [],
        toolsEnabled: false
    },

    // ========== Teaching Skills ==========
    'teaching': {
        id: 'teaching',
        name: 'Teaching & Explanation',
        name_zh: '教学讲解',
        description: 'Explain concepts clearly and patiently',
        category: 'education',
        promptEnhancement: `教学时：
1. 先了解学习者的现有水平
2. 从具体例子引入抽象概念
3. 使用类比解释复杂概念
4. 分解为易于消化的小步骤
5. 检查理解，适时调整节奏`,
        tools: [],
        toolsEnabled: false
    },

    'quiz-generation': {
        id: 'quiz-generation',
        name: 'Quiz Generation',
        name_zh: '测验生成',
        description: 'Create quizzes and exercises',
        category: 'education',
        promptEnhancement: `生成测验时：
1. 根据学习目标设计问题
2. 包含不同难度级别
3. 混合不同题型（选择、填空、问答）
4. 提供详细的答案解析
5. 给出学习建议和下一步`,
        tools: [],
        toolsEnabled: false
    },

    // ========== Emotional Support Skills ==========
    'active-listening': {
        id: 'active-listening',
        name: 'Active Listening',
        name_zh: '积极倾听',
        description: 'Listen empathetically and validate feelings',
        category: 'emotional',
        promptEnhancement: `倾听时：
1. 专注于用户表达的感受
2. 使用反馈式倾听（"听起来你感到..."）
3. 验证情感的合理性
4. 不急于提供建议或解决方案
5. 使用开放式问题鼓励表达`,
        tools: [],
        toolsEnabled: false
    },

    'emotional-support': {
        id: 'emotional-support',
        name: 'Emotional Support',
        name_zh: '情感支持',
        description: 'Provide empathetic emotional support',
        category: 'emotional',
        promptEnhancement: `提供情感支持时：
1. 保持温暖、非评判的态度
2. 承认和验证用户的感受
3. 提供安慰而不是建议
4. 适时分享正念和自我关怀技巧
5. 遇到严重问题时，建议寻求专业帮助`,
        tools: [],
        toolsEnabled: false
    },

    'mindfulness': {
        id: 'mindfulness',
        name: 'Mindfulness Guidance',
        name_zh: '正念引导',
        description: 'Guide mindfulness and relaxation exercises',
        category: 'emotional',
        promptEnhancement: `引导正念时：
1. 使用平静、缓慢的语气
2. 提供具体、可操作的指导
3. 从简单的呼吸练习开始
4. 逐步引导注意力
5. 以温和的方式结束`,
        tools: [],
        toolsEnabled: false
    },

    // ========== Creative Design Skills ==========
    'design-thinking': {
        id: 'design-thinking',
        name: 'Design Thinking',
        name_zh: '设计思维',
        description: 'Apply design thinking methodology',
        category: 'creative',
        promptEnhancement: `运用设计思维时：
1. 共情：深入理解用户需求
2. 定义：明确核心问题
3. 构思：头脑风暴多种方案
4. 原型：描述可视化方案
5. 测试：考虑如何验证设计`,
        tools: ['image_generation'],
        toolsEnabled: false
    },

    'brainstorming': {
        id: 'brainstorming',
        name: 'Brainstorming',
        name_zh: '头脑风暴',
        description: 'Generate creative ideas and solutions',
        category: 'creative',
        promptEnhancement: `头脑风暴时：
1. 先不评判，鼓励所有想法
2. 追求数量而非质量
3. 鼓励"疯狂"的想法
4. 组合和改进已有想法
5. 最后整理并评估可行性`,
        tools: [],
        toolsEnabled: false
    },

    'visual-design': {
        id: 'visual-design',
        name: 'Visual Design Feedback',
        name_zh: '视觉设计反馈',
        description: 'Provide UI/UX and visual design feedback',
        category: 'creative',
        promptEnhancement: `提供设计反馈时：
1. 评估整体视觉层次
2. 检查配色方案和对比度
3. 分析布局和空间使用
4. 考虑用户体验流程
5. 提供具体、可操作的改进建议`,
        tools: ['image_generation'],
        toolsEnabled: false
    }
};

/**
 * Get skills by category
 * @param {string} category - Category name
 * @returns {Array} Array of skills in the category
 */
export function getSkillsByCategory(category) {
    return Object.values(AGENT_SKILLS).filter(skill => skill.category === category);
}

/**
 * Get skill by ID
 * @param {string} skillId - Skill ID
 * @returns {Object|null} Skill object or null
 */
export function getSkillById(skillId) {
    return AGENT_SKILLS[skillId] || null;
}

/**
 * Combine multiple skills into a unified prompt enhancement
 * @param {Array<string>} skillIds - Array of skill IDs
 * @returns {string} Combined prompt enhancement
 */
export function combineSkillPrompts(skillIds) {
    const prompts = skillIds
        .map(id => AGENT_SKILLS[id]?.promptEnhancement)
        .filter(Boolean);

    if (prompts.length === 0) return '';

    return prompts.join('\n\n---\n\n');
}

/**
 * Get all tools required by a set of skills
 * @param {Array<string>} skillIds - Array of skill IDs
 * @returns {Array<string>} Unique array of tool names
 */
export function getRequiredTools(skillIds) {
    const tools = new Set();
    skillIds.forEach(id => {
        const skill = AGENT_SKILLS[id];
        if (skill?.tools) {
            skill.tools.forEach(tool => tools.add(tool));
        }
    });
    return Array.from(tools);
}

export default AGENT_SKILLS;
