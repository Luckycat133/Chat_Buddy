/**
 * Knowledge Graph - Structured curriculum with prerequisite relationships
 * Implements GraphRAG concepts for educational navigation
 */

// ========== Knowledge Graph Nodes ==========
export const KNOWLEDGE_NODES = {
    // ========== Mathematics ==========
    'math_arithmetic': {
        id: 'math_arithmetic',
        title: '算术基础',
        title_en: 'Arithmetic Basics',
        category: 'math',
        difficulty: 1,
        description: '加减乘除、分数、小数、百分比',
        keywords: ['加法', '减法', '乘法', '除法', '分数', 'fraction', 'percentage']
    },
    'math_algebra_basics': {
        id: 'math_algebra_basics',
        title: '代数基础',
        title_en: 'Algebra Basics',
        category: 'math',
        difficulty: 2,
        description: '变量、方程、不等式',
        keywords: ['变量', '方程', 'equation', 'variable', 'algebra']
    },
    'math_linear_equation': {
        id: 'math_linear_equation',
        title: '一次方程',
        title_en: 'Linear Equations',
        category: 'math',
        difficulty: 2,
        description: '一元一次方程的解法',
        keywords: ['一次方程', 'linear', '解方程']
    },
    'math_quadratic': {
        id: 'math_quadratic',
        title: '二次方程',
        title_en: 'Quadratic Equations',
        category: 'math',
        difficulty: 3,
        description: '二次方程求根公式、因式分解',
        keywords: ['二次方程', 'quadratic', '求根公式', '因式分解']
    },
    'math_completing_square': {
        id: 'math_completing_square',
        title: '配方法',
        title_en: 'Completing the Square',
        category: 'math',
        difficulty: 3,
        description: '配方法化简与求解',
        keywords: ['配方法', 'completing square']
    },
    'math_functions': {
        id: 'math_functions',
        title: '函数基础',
        title_en: 'Functions',
        category: 'math',
        difficulty: 3,
        description: '函数定义、定义域、值域',
        keywords: ['函数', 'function', '定义域', 'domain']
    },
    'math_calculus_limits': {
        id: 'math_calculus_limits',
        title: '极限',
        title_en: 'Limits',
        category: 'math',
        difficulty: 4,
        description: '极限的概念与计算',
        keywords: ['极限', 'limit', '趋近']
    },
    'math_derivatives': {
        id: 'math_derivatives',
        title: '导数',
        title_en: 'Derivatives',
        category: 'math',
        difficulty: 4,
        description: '导数的定义与求导法则',
        keywords: ['导数', 'derivative', '微分', '求导']
    },
    'math_integrals': {
        id: 'math_integrals',
        title: '积分',
        title_en: 'Integrals',
        category: 'math',
        difficulty: 5,
        description: '不定积分与定积分',
        keywords: ['积分', 'integral', '定积分', '不定积分']
    },

    // ========== Programming ==========
    'prog_basics': {
        id: 'prog_basics',
        title: '编程基础',
        title_en: 'Programming Basics',
        category: 'programming',
        difficulty: 1,
        description: '变量、数据类型、控制流',
        keywords: ['编程', 'programming', '变量', 'variable', 'if', 'for', 'while']
    },
    'prog_javascript': {
        id: 'prog_javascript',
        title: 'JavaScript 基础',
        title_en: 'JavaScript Basics',
        category: 'programming',
        difficulty: 2,
        description: 'JS 语法、DOM 操作、事件',
        keywords: ['javascript', 'js', 'dom', '事件', 'event']
    },
    'prog_python': {
        id: 'prog_python',
        title: 'Python 基础',
        title_en: 'Python Basics',
        category: 'programming',
        difficulty: 2,
        description: 'Python 语法、列表、字典',
        keywords: ['python', 'list', 'dict', '列表', '字典']
    },
    'prog_data_structures': {
        id: 'prog_data_structures',
        title: '数据结构',
        title_en: 'Data Structures',
        category: 'programming',
        difficulty: 3,
        description: '数组、链表、栈、队列、树、图',
        keywords: ['数据结构', 'array', 'linked list', 'stack', 'queue', 'tree', 'graph']
    },
    'prog_algorithms': {
        id: 'prog_algorithms',
        title: '算法',
        title_en: 'Algorithms',
        category: 'programming',
        difficulty: 4,
        description: '排序、搜索、动态规划',
        keywords: ['算法', 'algorithm', '排序', 'sort', 'search', 'dynamic programming']
    },
    'prog_react': {
        id: 'prog_react',
        title: 'React 框架',
        title_en: 'React Framework',
        category: 'programming',
        difficulty: 3,
        description: '组件、状态、Hooks',
        keywords: ['react', 'component', 'state', 'hooks', 'useState', 'useEffect']
    },

    // ========== Science ==========
    'sci_physics_mechanics': {
        id: 'sci_physics_mechanics',
        title: '力学',
        title_en: 'Mechanics',
        category: 'physics',
        difficulty: 2,
        description: '牛顿定律、运动学、力学分析',
        keywords: ['力学', 'mechanics', '牛顿', 'newton', '力', 'force']
    },
    'sci_physics_energy': {
        id: 'sci_physics_energy',
        title: '能量',
        title_en: 'Energy',
        category: 'physics',
        difficulty: 2,
        description: '动能、势能、能量守恒',
        keywords: ['能量', 'energy', '动能', '势能', '守恒']
    },
    'sci_chemistry_basics': {
        id: 'sci_chemistry_basics',
        title: '化学基础',
        title_en: 'Chemistry Basics',
        category: 'chemistry',
        difficulty: 2,
        description: '原子结构、化学键、周期表',
        keywords: ['化学', 'chemistry', '原子', 'atom', '化学键', '周期表']
    },
    'sci_biology_cell': {
        id: 'sci_biology_cell',
        title: '细胞生物学',
        title_en: 'Cell Biology',
        category: 'biology',
        difficulty: 2,
        description: '细胞结构、细胞分裂、DNA',
        keywords: ['细胞', 'cell', 'DNA', '生物', 'biology']
    },

    // ========== Languages ==========
    'lang_english_grammar': {
        id: 'lang_english_grammar',
        title: '英语语法',
        title_en: 'English Grammar',
        category: 'language',
        difficulty: 2,
        description: '时态、语态、从句',
        keywords: ['语法', 'grammar', 'tense', '时态', '从句']
    },
    'lang_english_writing': {
        id: 'lang_english_writing',
        title: '英语写作',
        title_en: 'English Writing',
        category: 'language',
        difficulty: 3,
        description: '议论文、记叙文、商务写作',
        keywords: ['写作', 'writing', 'essay', '作文']
    },

    // ========== Work Skills ==========
    'work_project_management': {
        id: 'work_project_management',
        title: '项目管理',
        title_en: 'Project Management',
        category: 'work',
        difficulty: 3,
        description: '计划、执行、监控、收尾',
        keywords: ['项目管理', 'project management', 'agile', 'scrum', 'PMP']
    },
    'work_data_analysis': {
        id: 'work_data_analysis',
        title: '数据分析',
        title_en: 'Data Analysis',
        category: 'work',
        difficulty: 3,
        description: 'Excel、SQL、数据可视化',
        keywords: ['数据分析', 'data analysis', 'excel', 'sql', '可视化']
    },
    'work_communication': {
        id: 'work_communication',
        title: '职场沟通',
        title_en: 'Workplace Communication',
        category: 'work',
        difficulty: 2,
        description: '演讲、汇报、邮件写作',
        keywords: ['沟通', 'communication', '演讲', '汇报', '邮件']
    },
    'work_leadership': {
        id: 'work_leadership',
        title: '领导力',
        title_en: 'Leadership',
        category: 'work',
        difficulty: 4,
        description: '团队管理、决策、激励',
        keywords: ['领导力', 'leadership', '管理', '团队']
    }
};

// ========== Knowledge Graph Edges (Prerequisites) ==========
export const KNOWLEDGE_EDGES = [
    // Math prerequisites
    { from: 'math_arithmetic', to: 'math_algebra_basics', type: 'PREREQUISITE_OF' },
    { from: 'math_algebra_basics', to: 'math_linear_equation', type: 'PREREQUISITE_OF' },
    { from: 'math_linear_equation', to: 'math_quadratic', type: 'PREREQUISITE_OF' },
    { from: 'math_algebra_basics', to: 'math_completing_square', type: 'PREREQUISITE_OF' },
    { from: 'math_completing_square', to: 'math_quadratic', type: 'PREREQUISITE_OF' },
    { from: 'math_algebra_basics', to: 'math_functions', type: 'PREREQUISITE_OF' },
    { from: 'math_functions', to: 'math_calculus_limits', type: 'PREREQUISITE_OF' },
    { from: 'math_calculus_limits', to: 'math_derivatives', type: 'PREREQUISITE_OF' },
    { from: 'math_derivatives', to: 'math_integrals', type: 'PREREQUISITE_OF' },

    // Programming prerequisites
    { from: 'prog_basics', to: 'prog_javascript', type: 'PREREQUISITE_OF' },
    { from: 'prog_basics', to: 'prog_python', type: 'PREREQUISITE_OF' },
    { from: 'prog_basics', to: 'prog_data_structures', type: 'PREREQUISITE_OF' },
    { from: 'prog_data_structures', to: 'prog_algorithms', type: 'PREREQUISITE_OF' },
    { from: 'prog_javascript', to: 'prog_react', type: 'PREREQUISITE_OF' },

    // Science prerequisites
    { from: 'math_algebra_basics', to: 'sci_physics_mechanics', type: 'PREREQUISITE_OF' },
    { from: 'sci_physics_mechanics', to: 'sci_physics_energy', type: 'PREREQUISITE_OF' },

    // Work skills prerequisites
    { from: 'work_communication', to: 'work_project_management', type: 'PREREQUISITE_OF' },
    { from: 'work_communication', to: 'work_leadership', type: 'PREREQUISITE_OF' },
    { from: 'math_arithmetic', to: 'work_data_analysis', type: 'PREREQUISITE_OF' },

    // Language prerequisites
    { from: 'lang_english_grammar', to: 'lang_english_writing', type: 'PREREQUISITE_OF' }
];

// ========== Graph Query Functions ==========

/**
 * Get all prerequisites for a given topic (multi-hop)
 */
export function getPrerequisites(topicId, depth = 3) {
    const prerequisites = [];
    const visited = new Set();

    function traverse(currentId, currentDepth) {
        if (currentDepth > depth || visited.has(currentId)) return;
        visited.add(currentId);

        KNOWLEDGE_EDGES
            .filter(edge => edge.to === currentId && edge.type === 'PREREQUISITE_OF')
            .forEach(edge => {
                prerequisites.push(edge.from);
                traverse(edge.from, currentDepth + 1);
            });
    }

    traverse(topicId, 0);
    return prerequisites;
}

/**
 * Get topics that depend on a given topic
 */
export function getDependents(topicId) {
    return KNOWLEDGE_EDGES
        .filter(edge => edge.from === topicId && edge.type === 'PREREQUISITE_OF')
        .map(edge => edge.to);
}

/**
 * Find topic by keyword matching
 */
export function findTopicByKeyword(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return Object.values(KNOWLEDGE_NODES).find(node =>
        node.keywords?.some(k => k.toLowerCase().includes(lowerKeyword)) ||
        node.title.toLowerCase().includes(lowerKeyword) ||
        node.title_en?.toLowerCase().includes(lowerKeyword)
    );
}

/**
 * Get topics by category
 */
export function getTopicsByCategory(category) {
    return Object.values(KNOWLEDGE_NODES).filter(node => node.category === category);
}

/**
 * Check which prerequisites a learner is missing
 */
export function checkMissingPrerequisites(topicId, masteredTopics = []) {
    const prereqs = getPrerequisites(topicId);
    return prereqs.filter(prereq => !masteredTopics.includes(prereq));
}

// ========== Quiz Bank (Sample) ==========
export const QUIZ_BANK = {
    'math_quadratic': [
        {
            question: '二次方程 x² + 5x + 6 = 0 的两个根分别是？',
            options: ['x = -2, x = -3', 'x = 2, x = 3', 'x = -1, x = -6', 'x = 1, x = 6'],
            answer: 0,
            explanation: '因式分解得 (x+2)(x+3) = 0，所以 x = -2 或 x = -3'
        },
        {
            question: '一元二次方程的求根公式是？',
            options: [
                'x = (-b ± √(b²-4ac)) / 2a',
                'x = (-b ± √(b²+4ac)) / 2a',
                'x = (b ± √(b²-4ac)) / 2a',
                'x = (-b ± √(4ac-b²)) / 2a'
            ],
            answer: 0
        }
    ],
    'prog_javascript': [
        {
            question: '在 JavaScript 中，以下哪个方法可以向数组末尾添加元素？',
            options: ['push()', 'pop()', 'shift()', 'unshift()'],
            answer: 0
        },
        {
            question: 'const 声明的变量可以被重新赋值吗？',
            options: ['不可以', '可以', '只能赋值一次', '取决于数据类型'],
            answer: 0
        }
    ],
    'prog_react': [
        {
            question: 'React 中用于管理组件状态的 Hook 是？',
            options: ['useState', 'useEffect', 'useContext', 'useReducer'],
            answer: 0
        }
    ]
};

export default {
    KNOWLEDGE_NODES,
    KNOWLEDGE_EDGES,
    QUIZ_BANK,
    getPrerequisites,
    getDependents,
    findTopicByKeyword,
    getTopicsByCategory,
    checkMissingPrerequisites
};
