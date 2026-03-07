/**
 * Tool Service - Handles execution of AI tool calls
 * Implements real capabilities with knowledge graph, learner profile, math.js, and Perplexity Sonar
 */

import { callAI } from './chatService';
import {
    KNOWLEDGE_NODES,
    QUIZ_BANK,
    findTopicByKeyword,
    checkMissingPrerequisites
} from '../../../data/knowledgeGraph';
import {
    getLearnerProfile,
    markAsMastered,
    markAsInProgress,
    recordStruggle
} from '../../../data/learnerProfile';

// Import math.js for symbolic math
import { evaluate, derivative, simplify } from 'mathjs';

// Import immersive translation service
import { translateWithReflection, detectDomain } from '../../../services/ai/translationService';
import { getCombinedGlossary } from '../../../data/glossary';

// Import Perplexity Sonar service for Scholar agent
import {
    sonarSearch,
    deepResearch,
    factCheck,
    formatCitationsForDisplay,
    generateAPACitation,
    DOMAIN_PRESETS,
    RECENCY_OPTIONS
} from '../../../services/perplexityService';

// T12: Memory Exchange for inter-character memory tool
import { requestMemory } from '../../../core/memory/MemoryExchange';

/**
 * Execute a named tool with provided arguments
 * @param {string} toolName 
 * @param {Object} args 
 * @returns {Promise<string>} Tool output
 */
export async function executeTool(toolName, args, extras = {}) {
    console.log(`[ToolService] Executing ${toolName} with args:`, args);

    // Simulate minimal network delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        switch (toolName) {
            // ========== Sensei Education Tools ==========
            case 'check_prerequisites':
                return checkPrerequisitesTool(args.topic);
            case 'execute_math':
                return executeMathTool(args.expression);
            case 'generate_quiz':
                return generateQuizTool(args.topic);
            case 'track_progress':
                return trackProgressTool(args.topic, args.status, args.misconception);

            // ========== Programming Tools ==========
            case 'run_code':
                return executeInSandbox(args.code, args.language || 'javascript');
            case 'search_docs':
                return mockSearchDocs(args.query);
            case 'analyze_code':
                return mockAnalyzeCode(args.code);

            // ========== Writing Tools ==========
            case 'check_grammar':
                return executeGrammarCheck(args.text);
            case 'translate':
                return executeAITranslate(args.text, args.targetLanguage);

            // ========== Immersive Translation Tools (Muse) ==========
            case 'immersive_translate':
                return executeImmersiveTranslate(args);
            case 'detect_content_domain':
                return detectContentDomain(args.text);

            // ========== Research Tools (Legacy) ==========
            case 'web_search':
                return executeWebSearch(args.query);
            case 'analyze_data':
                return executeDataAnalysis(args);

            // ========== Scholar Research Tools (Perplexity Sonar) ==========
            case 'sonar_search':
                return executeSonarSearch(args.query, args.domains, args.recency);
            case 'deep_research':
                return executeDeepResearch(args.query, args.depth);
            case 'fact_check':
                return executeFactCheck(args.claim);
            case 'cite_sources':
                return executeCiteSources(args.sources, args.format);

            // ========== Emotional Tools ==========
            case 'breathing_exercise':
                return "Let's take a deep breath in... [hold for 4s]... and breathe out... [hold for 4s]. Repeat 3 times.";
            case 'mood_tracking':
                return "Mood logged: " + (args.mood || 'Neutral');

            // ========== Creative Tools ==========
            case 'generate_image':
                return executeGenerateImage(args);
            case 'color_palette':
                return executeColorPalette(args);

            // ========== T12: Memory Exchange Tool ==========
            case 'MEMORY_REQUEST':
                return executeMemoryRequest(args, extras.personas || [], extras.requesterId || '__unknown__');

            // ========== T13: Agent Collaboration Tool ==========
            case 'delegate_task':
                return executeDelegateTask(args, extras.personas || [], extras.delegationDepth || 0);

            default:
                return `Error: Tool '${toolName}' not found.`;
        }
    } catch (error) {
        console.error(`[ToolService] Error executing ${toolName}:`, error);
        return `Error: ${error.message}`;
    }
}

// ========== Sensei Education Tool Implementations ==========

/**
 * Check if learner has prerequisites for a topic
 */
function checkPrerequisitesTool(topicKeyword) {
    if (!topicKeyword) return "Error: No topic provided";

    // Find the topic
    const topic = findTopicByKeyword(topicKeyword);
    if (!topic) {
        return `[Prerequisites Check] Topic "${topicKeyword}" not found in knowledge graph.`;
    }

    // Get learner's mastered topics
    const profile = getLearnerProfile();
    const missing = checkMissingPrerequisites(topic.id, profile.mastered);

    if (missing.length === 0) {
        return `[Prerequisites Check] ✅ Student has all prerequisites for "${topic.title}". Ready to learn!`;
    }

    const missingNames = missing.map(id => KNOWLEDGE_NODES[id]?.title || id).join(', ');
    return `[Prerequisites Check] ⚠️ Missing prerequisites for "${topic.title}":
${missingNames}

Recommendation: Review these topics first before proceeding.`;
}

/**
 * Execute mathematical expression using math.js
 */
function executeMathTool(expression) {
    if (!expression) return "Error: No expression provided";

    try {
        // Try to evaluate
        const result = evaluate(expression);

        // Additional symbolic operations if applicable
        let output = `[Math Result]\nExpression: ${expression}\nResult: ${result}`;

        // Try derivative if it looks like a function of x
        if (expression.includes('x') && !expression.includes('=')) {
            try {
                const deriv = derivative(expression, 'x').toString();
                output += `\nDerivative: ${deriv}`;
            } catch (_e) {
                // Derivative not applicable
            }
        }

        // Try simplification
        try {
            const simplified = simplify(expression).toString();
            if (simplified !== expression) {
                output += `\nSimplified: ${simplified}`;
            }
        } catch (_e) {
            // Simplification not applicable
        }

        return output;
    } catch (e) {
        return `[Math Error] ${e.message}\nTip: Check syntax. Examples: "2+2", "sqrt(16)", "derivative('x^2', 'x')"`;
    }
}

/**
 * Generate quiz from knowledge graph
 */
function generateQuizTool(topicKeyword) {
    if (!topicKeyword) return "Error: No topic provided";

    // Find topic
    const topic = findTopicByKeyword(topicKeyword);

    // Check if we have quizzes for this topic
    let quizzes = null;
    if (topic && QUIZ_BANK[topic.id]) {
        quizzes = QUIZ_BANK[topic.id];
    }

    if (!quizzes || quizzes.length === 0) {
        // Generate a generic prompt for the AI to create a quiz
        return `[Quiz Generation] No pre-made quiz for "${topicKeyword}".
Generating custom quiz...

Please create 2-3 multiple choice questions about "${topicKeyword}" to test the student's understanding.`;
    }

    // Pick a random quiz
    const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];

    // Mark topic as in progress
    if (topic) markAsInProgress(topic.id);

    return `[Quiz: ${topic.title}]

❓ ${quiz.question}

${quiz.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}

(Correct answer stored internally for verification)
[ANSWER_KEY: ${quiz.answer}]`;
}

/**
 * Track learning progress
 */
function trackProgressTool(topicKeyword, status, misconception) {
    if (!topicKeyword) return "Error: No topic provided";

    const topic = findTopicByKeyword(topicKeyword);
    const topicId = topic?.id || topicKeyword;
    const topicName = topic?.title || topicKeyword;

    switch (status) {
        case 'mastered':
            markAsMastered(topicId);
            return `[Progress Tracked] ✅ "${topicName}" marked as MASTERED! Great job!`;

        case 'struggling':
            recordStruggle(topicId, misconception);
            return `[Progress Tracked] 📝 Recorded difficulty with "${topicName}".${misconception ? ` Misconception: ${misconception}` : ''}`;

        case 'in_progress':
        default:
            markAsInProgress(topicId);
            return `[Progress Tracked] 📚 "${topicName}" marked as IN PROGRESS.`;
    }
}

// ========== Programming Tool Implementations ==========

// T13: Singleton sandbox worker for isolated code execution
let _sandboxWorker = null;
let _workerRequestCounter = 0;
const _workerCallbacks = new Map(); // requestId → { resolve, reject }

function getSandboxWorker() {
    if (_sandboxWorker) return _sandboxWorker;
    _sandboxWorker = new Worker('/sandbox.worker.js');
    _sandboxWorker.onmessage = (event) => {
        const { type, requestId, status, output } = event.data;
        if (type === 'STATUS') {
            console.log('[SandboxWorker]', output);
            return;
        }
        if (type === 'RESULT' && _workerCallbacks.has(requestId)) {
            const { resolve } = _workerCallbacks.get(requestId);
            _workerCallbacks.delete(requestId);
            resolve({ status, output });
        }
    };
    _sandboxWorker.onerror = (err) => {
        console.error('[SandboxWorker] Uncaught error:', err);
        // Reject all pending and reset
        _workerCallbacks.forEach(({ reject }) => reject(new Error('Worker crashed')));
        _workerCallbacks.clear();
        _sandboxWorker = null;
    };
    return _sandboxWorker;
}

/**
 * T13: Execute code in the isolated sandbox worker with a 10-second timeout.
 * Supports 'javascript' and 'python'.
 */
async function executeInSandbox(code, language = 'javascript') {
    if (!code) return "Error: No code provided";

    const requestId = ++_workerRequestCounter;
    const TIMEOUT_MS = language === 'python' ? 30000 : 10000; // Python WASM needs more time

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            if (_workerCallbacks.has(requestId)) {
                _workerCallbacks.delete(requestId);
                // Kill and recreate worker to stop infinite loops
                try { _sandboxWorker?.terminate(); } catch (_) { /* */ }
                _sandboxWorker = null;
                resolve(`[Execution Timeout] Code exceeded ${TIMEOUT_MS / 1000}s limit and was terminated.`);
            }
        }, TIMEOUT_MS);

        _workerCallbacks.set(requestId, {
            resolve: ({ status, output }) => {
                clearTimeout(timeout);
                const label = status === 'error' ? '[Execution Error]' : '[Execution Result]';
                resolve(`${label}\n${output}`);
            },
            reject: (err) => {
                clearTimeout(timeout);
                resolve(`[Execution Error]\n${err.message}`);
            },
        });

        try {
            getSandboxWorker().postMessage({ type: 'EXECUTE', requestId, language, code });
        } catch (err) {
            clearTimeout(timeout);
            _workerCallbacks.delete(requestId);
            _sandboxWorker = null;
            resolve(`[Execution Error]\n${err.message}`);
        }
    });
}

// ========== Research Tool Implementations ==========

/**
 * Web search via Perplexity Sonar
 */
async function executeWebSearch(query) {
    try {
        const searchModel = 'llama-3.1-sonar-small-128k-online';
        const prompt = `Search the web for: "${query}". Return a concise summary with key findings.`;

        const result = await callAI(
            [{ role: 'user', content: prompt }],
            { model: searchModel, maxTokens: 500, temperature: 0.2 }
        );

        return result ? `[Search Results]\n${result}` : "[Search Error] No results.";
    } catch (e) {
        return `[Search Error] ${e.message}`;
    }
}

/**
 * AI-driven translation
 */
async function executeAITranslate(text, targetLang = 'Chinese') {
    const systemPrompt = `You are a professional translator.
1. Translate directly
2. Polish for naturalness
3. Return ONLY the final translation`;

    const result = await callAI(
        [{ role: 'user', content: `Translate into ${targetLang}:\n${text}` }],
        { systemPrompt, maxTokens: 1000, temperature: 0.3 }
    );

    return result || "[Translation Failed]";
}

// ========== Writing Tool Implementations ==========

/**
 * AI-driven grammar checking with detailed feedback
 */
async function executeGrammarCheck(text) {
    if (!text) return "[Grammar Check Error] No text provided";

    const systemPrompt = `You are a professional grammar checker and writing coach.
Analyze the provided text for:
1. Grammar errors (subject-verb agreement, tense issues, etc.)
2. Spelling mistakes
3. Punctuation errors
4. Style improvements (clarity, conciseness, word choice)

For each issue found:
- Quote the problematic text
- Provide the correction
- Briefly explain why

If no issues found, simply confirm: "No grammar issues found. The text looks good!"

Format your response clearly with markdown.`;

    try {
        const result = await callAI(
            [{ role: 'user', content: text }],
            { systemPrompt, maxTokens: 600, temperature: 0.2 }
        );

        return `## Grammar Check Results

${result}`;
    } catch (error) {
        console.error('[Grammar Check Error]', error);
        return `[Grammar Check Error] ${error.message}`;
    }
}

/**
 * AI-based data analysis with summary statistics and insights
 */
async function executeDataAnalysis(args) {
    const { data, type = 'general' } = args;
    if (!data) return "[Data Analysis Error] No data provided";

    const systemPrompt = `You are a data analyst. Analyze the provided data and provide:
1. Summary statistics (count, average, min, max if numeric)
2. Key patterns or trends
3. Notable observations
4. Suggestions for further analysis

Format your response clearly with markdown. Be concise but thorough.`;

    try {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        const result = await callAI(
            [{ role: 'user', content: `Analyze this ${type} data:\n${dataStr}` }],
            { systemPrompt, maxTokens: 800, temperature: 0.3 }
        );

        return `## Data Analysis Results

${result}`;
    } catch (error) {
        console.error('[Data Analysis Error]', error);
        return `[Data Analysis Error] ${error.message}`;
    }
}

/**
 * AI-based image generation description (simulated since no image API available)
 */
async function executeGenerateImage(args) {
    const { prompt, size = '1024x1024' } = args;
    if (!prompt) return "[Image Generation Error] No prompt provided";

    const systemPrompt = `You are an image generation describer. The user wants to generate an image with the prompt: "${prompt}".

Describe what the generated image would look like in vivid detail:
1. Main subject and composition
2. Colors and lighting
3. Style and mood
4. Any notable details

Then acknowledge that this is a simulated response and suggest connecting an actual image generation API for real images.`;

    try {
        const result = await callAI(
            [{ role: 'user', content: `Describe what an image with prompt "${prompt}" would look like` }],
            { systemPrompt, maxTokens: 400, temperature: 0.7 }
        );

        return `## Image Generation Request

**Prompt:** "${prompt}"
**Requested Size:** ${size}

---

${result}

---

💡 *Note: This is a simulated description. To generate actual images, connect an image generation API (like DALL-E, Midjourney, or Stable Diffusion) in your settings.*`;
    } catch (error) {
        console.error('[Image Generation Error]', error);
        return `[Image Generation Error] ${error.message}`;
    }
}

/**
 * AI-based color palette generation
 */
async function executeColorPalette(args) {
    const { mood, baseColor, count = 5 } = args;

    // Predefined palettes as fallback
    const palettes = {
        warm: ['#FF6B6B', '#FF8E53', '#FFCD56', '#FFD93D', '#FFC857'],
        cool: ['#4ECDC4', '#44A08D', '#96C93D', '#00B4DB', '#0083B0'],
        dark: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7'],
        pastel: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF'],
        vibrant: ['#FF006E', '#FB5607', '#FFBE0B', '#8338EC', '#3A86FF'],
        nature: ['#2D5016', '#538D22', '#73A942', '#AAD576', '#D4F1AC'],
        ocean: ['#006D77', '#83C5BE', '#EDF6F9', '#FFDDD2', '#E29578'],
        sunset: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93']
    };

    const systemPrompt = `Generate a ${count}-color palette${mood ? ` for a "${mood}" mood` : ''}${baseColor ? ` based on ${baseColor}` : ''}.

For each color, provide:
- Hex code
- Color name
- Suggested usage (e.g., primary, accent, background)

Format:
**Color Name**: #HEXCODE - Usage description

Also include a brief description of the overall palette mood and best use cases.`;

    try {
        const result = await callAI(
            [{ role: 'user', content: 'Generate a color palette' }],
            { systemPrompt, maxTokens: 500, temperature: 0.6 }
        );

        // Also provide a fallback palette if AI fails
        const fallback = palettes[mood] || palettes.warm;

        return `## Color Palette Generated

${result}

---

**Quick Reference Palette:** ${fallback.slice(0, count).join(', ')}

💡 *Tip: Use these colors consistently across your design for visual harmony.*`;
    } catch (error) {
        console.error('[Color Palette Error]', error);
        const fallback = palettes[mood] || palettes.warm;
        return `## Color Palette (${mood || 'warm'})

${fallback.slice(0, count).join(', ')}

*Error generating detailed palette: ${error.message}*`;
    }
}

// ========== Legacy Mock Implementations ==========

function mockSearchDocs(query) {
    return `[Documentation Search for "${query}"]
1. Official Guide: ${query} usage and parameters
2. API Reference: Method signatures for ${query}`;
}

function mockAnalyzeCode(_code) {
    return `[Static Analysis]
- Complexity: Low
- Maintainability: High
- Potential Issues: None detected`;
}

// ========== Immersive Translation Implementations ==========

/**
 * Execute immersive translation with reflective workflow
 * Uses two-step process: literal → polished
 * @param {Object} args - Translation arguments
 * @param {string} args.text - Text to translate
 * @param {string} args.targetLang - Target language (default: Chinese)
 * @param {string} args.domain - Content domain (auto-detected if not specified)
 * @param {string} args.context - Optional context (page title, etc.)
 * @returns {Promise<string>} Formatted translation result
 */
async function executeImmersiveTranslate(args) {
    const { text, targetLang = 'Chinese', domain, context } = args;

    if (!text) {
        return "[Translation Error] No text provided. Please provide text to translate.";
    }

    try {
        console.log('[ImmersiveTranslate] Starting translation...');

        // Get relevant glossary terms based on detected/specified domain
        const detectedDomain = domain || detectDomain(text);
        const glossary = getCombinedGlossary(detectedDomain, targetLang === 'Chinese' ? 'zh' : 'en');

        // Execute two-step reflective translation
        const result = await translateWithReflection(text, {
            targetLang,
            domain: detectedDomain,
            glossary,
            context
        });

        // Format the output for display
        const domainLabels = {
            technical: '技术文档 (Technical)',
            literary: '文学作品 (Literary)',
            general: '通用文本 (General)',
            bilingual: '双语混合 (Bilingual)'
        };

        return `📚 **沉浸式翻译完成** | Immersive Translation Complete

🏷️ **检测领域**: ${domainLabels[result.domain] || result.domain}
📝 **术语约束**: ${glossary.length} 个术语已应用

---

### Step 1: 直译 (Literal Translation)
> ${result.step1}

---

### Step 2: 润色 (Polished Translation)
> ${result.step2}

---

💡 *Step 2 是推荐的最终译文*`;

    } catch (error) {
        console.error('[ImmersiveTranslate] Error:', error);
        return `[Translation Error] ${error.message}

请检查：
1. API 密钥是否已配置
2. 网络连接是否正常
3. 输入文本是否有效`;
    }
}

/**
 * Detect content domain for translation
 * @param {string} text - Text to analyze
 * @returns {string} Domain detection result
 */
function detectContentDomain(text) {
    if (!text) {
        return "[Domain Detection Error] No text provided.";
    }

    const domain = detectDomain(text);

    const descriptions = {
        technical: '**技术文档** - 检测到代码、API术语或Markdown格式。将保留代码块和技术术语不翻译。',
        literary: '**文学作品** - 检测到叙事性内容、对话或情感表达。将注重文化适配和情感传递。',
        general: '**通用文本** - 未检测到明显特征。将使用平衡的翻译策略。'
    };

    return `🔍 **内容领域检测** | Content Domain Detection

检测结果: ${descriptions[domain]}

---

📊 **推荐翻译策略**:
- 领域: \`${domain}\`
- 专家: ${domain === 'technical' ? '技术文档专家' : domain === 'literary' ? '文学意译专家' : '通用翻译专家'}

💡 您可以在翻译时指定 \`domain\` 参数来覆盖自动检测。`;
}

// ========== Scholar Perplexity Sonar Tool Implementations ==========

/**
 * Execute a Sonar search with domain and recency filtering
 * @param {string} query - Search query
 * @param {string} domains - Domain preset ('academic', 'news', 'tech', 'general')
 * @param {string} recency - Recency filter ('hour', 'day', 'week', 'month', 'year')
 * @returns {Promise<string>} Formatted search results
 */
async function executeSonarSearch(query, domains = 'general', recency = null) {
    if (!query) {
        return "[Sonar Search Error] 请提供搜索查询。";
    }

    try {
        console.log(`[ToolService] Sonar search: "${query}" | domains: ${domains} | recency: ${recency}`);

        // Map domain preset string to actual domains array
        let domainFilter = [];
        switch (domains?.toLowerCase()) {
            case 'academic':
                domainFilter = DOMAIN_PRESETS.ACADEMIC;
                break;
            case 'news':
                domainFilter = DOMAIN_PRESETS.NEWS;
                break;
            case 'tech':
                domainFilter = DOMAIN_PRESETS.TECH;
                break;
            default:
                domainFilter = DOMAIN_PRESETS.GENERAL;
        }

        // Map recency string to valid option
        let recencyFilter = null;
        if (recency && RECENCY_OPTIONS[recency.toUpperCase()]) {
            recencyFilter = RECENCY_OPTIONS[recency.toUpperCase()];
        }

        const result = await sonarSearch(query, {
            domainFilter,
            recency: recencyFilter,
            maxTokens: 1024
        });

        // Format the response for the AI to use
        let output = `🔍 **Sonar 搜索结果** | Query: "${query}"

${result.answer}

---

📚 **来源 (${result.searchResults.length} 条)**:
${formatCitationsForDisplay(result.searchResults)}`;

        return output;

    } catch (error) {
        console.error('[ToolService] Sonar search error:', error);
        return `[Sonar Search Error] ${error.message}

请检查：
1. Perplexity API 密钥是否已在 .env 中配置
2. 网络连接是否正常
3. 查询是否有效`;
    }
}

/**
 * Execute deep multi-hop research
 * @param {string} query - Research question
 * @param {number} depth - Search depth (1-3 hops)
 * @returns {Promise<string>} Comprehensive research results
 */
async function executeDeepResearch(query, depth = 2) {
    if (!query) {
        return "[Deep Research Error] 请提供研究问题。";
    }

    try {
        console.log(`[ToolService] Deep research: "${query}" | depth: ${depth}`);

        const result = await deepResearch(query, {
            depth: Math.min(parseInt(depth) || 2, 3),
            domainFilter: DOMAIN_PRESETS.ACADEMIC // Default to academic for deep research
        });

        let output = `📖 **深度研究结果** | Query: "${query}"
🔄 完成 ${result.hopsCompleted} 轮搜索

---

## 综合分析

${result.synthesis}

---

## 📚 所有来源 (${result.allSources.length} 条)

${result.allSources.map((s, i) => `[${i + 1}] ${s.title}${s.hopNumber ? ` (Hop ${s.hopNumber})` : ''}
    ${s.url}`).join('\n')}

---

## 🔍 搜索轨迹
${result.searchQueries.map((q, i) => `${i + 1}. ${q.substring(0, 100)}...`).join('\n')}`;

        return output;

    } catch (error) {
        console.error('[ToolService] Deep research error:', error);
        return `[Deep Research Error] ${error.message}`;
    }
}

/**
 * Execute fact-checking on a claim
 * @param {string} claim - The claim to verify
 * @returns {Promise<string>} Fact-check verdict with sources
 */
async function executeFactCheck(claim) {
    if (!claim) {
        return "[Fact Check Error] 请提供需要验证的声明。";
    }

    try {
        console.log(`[ToolService] Fact check: "${claim}"`);

        const result = await factCheck(claim);

        // Map verdict to emoji and Chinese
        const verdictMap = {
            verified: { emoji: '✅', text: '已验证 (Verified)', color: 'green' },
            disputed: { emoji: '⚠️', text: '存在争议 (Disputed)', color: 'yellow' },
            unverifiable: { emoji: '❓', text: '无法验证 (Unverifiable)', color: 'gray' }
        };

        const confidenceMap = {
            high: '🔵 高置信度',
            medium: '🟡 中置信度',
            low: '🔴 低置信度'
        };

        const v = verdictMap[result.verdict] || verdictMap.unverifiable;
        const c = confidenceMap[result.confidence] || confidenceMap.low;

        let output = `🔬 **事实核查结果** | Claim: "${claim}"

---

## 判定结果
${v.emoji} **${v.text}**
${c}

---

## 分析说明
${result.explanation}

${result.key_evidence ? `
### 关键证据
${result.key_evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}
` : ''}

---

## 📚 参考来源 (${result.sources?.length || 0} 条)
${result.sources ? formatCitationsForDisplay(result.sources) : '无来源数据'}`;

        return output;

    } catch (error) {
        console.error('[ToolService] Fact check error:', error);
        return `[Fact Check Error] ${error.message}`;
    }
}

/**
 * Generate academic citations in specified format
 * @param {Array} sources - Array of source objects from search results
 * @param {string} format - Citation format ('apa' or 'mla')
 * @returns {string} Formatted citations
 */
function executeCiteSources(sources, format = 'apa') {
    if (!sources || sources.length === 0) {
        return `[Citation Generator] 
        
请在对话中先使用 \`sonar_search\` 或 \`deep_research\` 获取来源，
然后我会自动生成引用。

示例查询:
- "帮我搜索近期关于AI的研究，然后生成APA引用"
- "深度研究量子计算的最新进展，并生成MLA格式引用"`;
    }

    const formatUpper = format?.toUpperCase() || 'APA';

    let output = `📝 **学术引用 (${formatUpper} 格式)**\n\n`;

    sources.forEach((source, i) => {
        if (formatUpper === 'APA') {
            output += `[${i + 1}] ${generateAPACitation(source)}\n\n`;
        } else {
            // MLA format
            const { title, url, date } = source;
            const domain = new URL(url).hostname;
            const accessDate = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            output += `[${i + 1}] "${title}." *${domain}*, ${date || 'n.d.'} Web. ${accessDate}. <${url}>\n\n`;
        }
    });

    return output;
}

// ========== T12: Memory Exchange Implementation ==========

/**
 * Execute a MEMORY_REQUEST tool call.
 * @param {Object} args - { target, topic }
 * @param {Array} personas - All loaded personas
 */
async function executeMemoryRequest(args, personas, requesterId = '__unknown__') {
    const { target, topic } = args;
    if (!target || !topic) {
        return '[MEMORY_REQUEST Error] Missing required fields: target and topic.';
    }
    return requestMemory(requesterId, target, topic, personas);
}

// ========== T13: Agent Collaboration Implementation ==========

/**
 * Delegate a sub-task to another agent and return its response.
 * Max delegation depth: 2 — prevents infinite agent loops.
 *
 * @param {Object} args        - { agentId, prompt }
 * @param {Array}  personas    - Full persona list to look up the target agent
 * @param {number} depth       - Current delegation depth (passed by AIPipeline)
 * @returns {Promise<string>}  - Delegated agent's response
 */
async function executeDelegateTask(args, personas, depth = 0) {
    const { agentId, prompt } = args;

    if (!agentId || !prompt) {
        return '[Delegate Error] Missing required fields: agentId and prompt.';
    }
    if (depth >= 2) {
        return '[Delegate Error] Maximum delegation depth reached (2). Cannot delegate further.';
    }

    const targetAgent = personas.find(p => p.id === agentId);
    if (!targetAgent) {
        return `[Delegate Error] Agent "${agentId}" not found.`;
    }

    console.log(`[ToolService] Delegating to ${targetAgent.name}: "${prompt.slice(0, 80)}..."`);

    try {
        const systemPrompt = targetAgent.systemPrompt ||
            `You are ${targetAgent.name}, a specialized AI assistant. ${targetAgent.personality || ''}`;

        const result = await callAI(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            { agentId, maxTokens: 800, temperature: 0.7 }
        );

        if (!result) return `[Delegate Error] ${targetAgent.name} did not respond.`;

        return `[Delegated response from ${targetAgent.name}]\n${result}`;
    } catch (e) {
        return `[Delegate Error] ${targetAgent.name} failed: ${e.message}`;
    }
}

export default executeTool;
