import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = process.cwd();

function readCurrent(relPath) {
    return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function readHead(relPath) {
    return execSync(`git show HEAD:${relPath}`, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

function unescapeTemplate(text = '') {
    return text
        .replace(/\\`/g, '`')
        .replace(/\r\n/g, '\n');
}

function estimateTokens(text = '') {
    const cjkCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const nonCjkCount = text.length - cjkCount;
    return Math.ceil((cjkCount * 0.9) + (nonCjkCount / 4));
}

function metrics(text = '') {
    return {
        chars: text.length,
        estTokens: estimateTokens(text)
    };
}

function percent(delta, base) {
    if (!base) return 'n/a';
    return `${((delta / base) * 100).toFixed(1)}%`;
}

function formatNum(num) {
    return `${num}`.padStart(6, ' ');
}

function extractTaskAgentPrompts(source) {
    const prompts = {};
    const regex = /id:\s*'([^']+)'[\s\S]*?systemPrompt:\s*`((?:\\`|[^`])*)`/g;
    let match = regex.exec(source);
    while (match) {
        const id = match[1];
        if (id.startsWith('agent-')) {
            prompts[id] = unescapeTemplate(match[2]);
        }
        match = regex.exec(source);
    }
    return prompts;
}

function extractDomainPrompt(source, domain, vars) {
    const domainMarkers = ['technical', 'literary', 'general', 'bilingual'];
    const start = source.indexOf(`${domain}: {`);
    if (start < 0) {
        throw new Error(`Cannot find domain block: ${domain}`);
    }

    let end = source.length;
    for (const marker of domainMarkers) {
        if (marker === domain) continue;
        const idx = source.indexOf(`${marker}: {`, start + 1);
        if (idx >= 0 && idx < end) end = idx;
    }

    const block = source.slice(start, end);
    const match = block.match(/return `([\s\S]*?)`;/);
    if (!match) {
        throw new Error(`Cannot find return template for domain: ${domain}`);
    }

    const template = unescapeTemplate(match[1]);
    return template.replace(/\$\{(\w+)\}/g, (_all, key) => vars[key] ?? '');
}

function summarizeRows(rows) {
    const header = [
        'Item'.padEnd(36, ' '),
        'Before(chars/tok)'.padStart(20, ' '),
        'After(chars/tok)'.padStart(20, ' '),
        'Delta(chars/tok)'.padStart(20, ' ')
    ].join(' | ');

    const line = '-'.repeat(header.length);
    console.log(header);
    console.log(line);

    for (const row of rows) {
        const before = `${formatNum(row.before.chars)}/${formatNum(row.before.estTokens)}`;
        const after = `${formatNum(row.after.chars)}/${formatNum(row.after.estTokens)}`;
        const dChars = row.after.chars - row.before.chars;
        const dTok = row.after.estTokens - row.before.estTokens;
        const delta = `${formatNum(dChars)}/${formatNum(dTok)}`;
        console.log(`${row.name.padEnd(36, ' ')} | ${before} | ${after} | ${delta}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function runPromptSizeBenchmark() {
    const taskAgentsPath = 'src/data/taskAgents.js';
    const expertsPath = 'src/data/translationExperts.js';

    const oldTaskSource = readHead(taskAgentsPath);
    const newTaskSource = readCurrent(taskAgentsPath);
    const oldExpertsSource = readHead(expertsPath);
    const newExpertsSource = readCurrent(expertsPath);

    const oldTaskPrompts = extractTaskAgentPrompts(oldTaskSource);
    const newTaskPrompts = extractTaskAgentPrompts(newTaskSource);

    const rows = [];

    const taskAgentIds = ['agent-coder', 'agent-muse', 'agent-scholar', 'agent-sensei', 'agent-aurora', 'agent-pixel'];
    let taskOldTotal = '';
    let taskNewTotal = '';
    for (const id of taskAgentIds) {
        const oldPrompt = oldTaskPrompts[id] || '';
        const newPrompt = newTaskPrompts[id] || '';
        rows.push({ name: `taskAgent:${id}`, before: metrics(oldPrompt), after: metrics(newPrompt) });
        taskOldTotal += oldPrompt;
        taskNewTotal += newPrompt;
    }
    rows.push({ name: 'taskAgent:TOTAL', before: metrics(taskOldTotal), after: metrics(taskNewTotal) });

    const vars = { targetLang: 'Chinese', sourceLang: 'English', termsPrompt: '' };
    const domains = ['technical', 'literary', 'general', 'bilingual'];
    let expertsOldTotal = '';
    let expertsNewTotal = '';
    for (const domain of domains) {
        const oldPrompt = extractDomainPrompt(oldExpertsSource, domain, vars);
        const newPrompt = extractDomainPrompt(newExpertsSource, domain, vars);
        rows.push({ name: `translationExpert:${domain}`, before: metrics(oldPrompt), after: metrics(newPrompt) });
        expertsOldTotal += oldPrompt;
        expertsNewTotal += newPrompt;
    }
    rows.push({ name: 'translationExpert:TOTAL', before: metrics(expertsOldTotal), after: metrics(expertsNewTotal) });

    console.log('\n=== Prompt Size Benchmark (HEAD -> Working Tree) ===');
    summarizeRows(rows);

    const leafRows = rows.filter(row => !row.name.endsWith(':TOTAL'));
    const beforeTotalTokens = leafRows.reduce((sum, r) => sum + r.before.estTokens, 0);
    const afterTotalTokens = leafRows.reduce((sum, r) => sum + r.after.estTokens, 0);
    const tokenDelta = afterTotalTokens - beforeTotalTokens;
    const charBefore = leafRows.reduce((sum, r) => sum + r.before.chars, 0);
    const charAfter = leafRows.reduce((sum, r) => sum + r.after.chars, 0);
    const charDelta = charAfter - charBefore;

    console.log('\n=== Aggregate ===');
    console.log(`Total chars: ${charBefore} -> ${charAfter} (${charDelta}, ${percent(charDelta, charBefore)})`);
    console.log(`Est tokens: ${beforeTotalTokens} -> ${afterTotalTokens} (${tokenDelta}, ${percent(tokenDelta, beforeTotalTokens)})`);
}

function runContractSmokeChecks() {
    console.log('\n=== Contract Smoke Checks (Current Runtime) ===');

    const taskSource = readCurrent('src/data/taskAgents.js');
    const expertSource = readCurrent('src/data/translationExperts.js');
    const pipelineSource = readCurrent('src/core/chat/AIPipeline.js');

    const taskPrompts = extractTaskAgentPrompts(taskSource);
    const musePrompt = taskPrompts['agent-muse'] || '';
    assert(musePrompt.includes('当前回复内一次完成'), 'Muse prompt must keep the one-reply translation contract');
    assert(musePrompt.includes('最终自然译文'), 'Muse prompt must keep the final natural translation contract');
    assert(taskSource.includes("name: 'immersive_translate'"), 'Muse must still expose immersive_translate');

    const techPrompt = extractDomainPrompt(expertSource, 'technical', { targetLang: 'Chinese', sourceLang: 'English', termsPrompt: '' });
    assert(techPrompt.includes('step1') && techPrompt.includes('step2'), 'Translation expert prompt must preserve YAML step1/step2 contract');
    assert(techPrompt.includes('Return YAML only'), 'Translation expert prompt must explicitly demand YAML output');

    const scholarPrompt = taskPrompts['agent-scholar'] || '';
    assert(scholarPrompt.includes('[n]'), 'Scholar prompt must keep citation marker requirement');
    assert(scholarPrompt.includes('📚 来源'), 'Scholar prompt must keep source list section');

    assert(pipelineSource.includes('[TOOL_CALL:'), 'AIPipeline prompt must keep tool call tag');
    assert(pipelineSource.includes('[MEMORY_REQUEST:'), 'AIPipeline prompt must keep memory request tag');
    assert(pipelineSource.includes('TURN RULES:'), 'AIPipeline must include dynamic per-turn rules');
    assert(pipelineSource.includes('MAX_LLM_CALLS_PER_TURN = 2'), 'AIPipeline must cap model-directed tool turns at two requests');
    assert(pipelineSource.includes('MAX_HISTORY_MESSAGES = 48'), 'AIPipeline must preserve the expanded recent-message window');
    assert(pipelineSource.includes('MAX_HISTORY_CHARS = 100000'), 'AIPipeline must preserve the expanded character window');

    console.log('PASS: Muse keeps one-reply translation behavior and the translation tool');
    console.log('PASS: Translation experts keep YAML protocol (step1/step2)');
    console.log('PASS: Scholar keeps citation and source requirements');
    console.log('PASS: AIPipeline keeps dynamic prompt, context, and request-budget contracts');
}

try {
    runPromptSizeBenchmark();
    runContractSmokeChecks();
    console.log('\nBenchmark completed successfully.');
} catch (error) {
    console.error('\nBenchmark failed:', error.message);
    process.exitCode = 1;
}
