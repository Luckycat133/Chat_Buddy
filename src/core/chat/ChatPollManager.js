/**
 * ChatPollManager — 投票管理
 * 处理聊天中的投票逻辑，从 ChatEngine.js 提取。
 */

export function votePoll(chat, pollId, optionId, action = 'switch', userId = 'user-me') {
  const polls = chat.polls || [];
  const pollIndex = polls.findIndex(p => p.id === pollId);
  if (pollIndex === -1) return { success: false, error: 'Poll not found', chat };

  const poll = { ...polls[pollIndex] };

  if (poll.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now()) {
    return { success: false, error: 'Poll has expired', chat };
  }

  let updatedOptions;

  if (action === 'add') {
    updatedOptions = poll.options.map(opt => {
      if (opt.id === optionId && !opt.votes?.includes(userId)) {
        return { ...opt, votes: [...(opt.votes || []), userId] };
      }
      return opt;
    });
  } else if (action === 'remove') {
    updatedOptions = poll.options.map(opt => {
      if (opt.id === optionId) {
        return { ...opt, votes: opt.votes?.filter(v => v !== userId) || [] };
      }
      return opt;
    });
  } else {
    const currentlyVoted = poll.options.find(opt => opt.id === optionId && opt.votes?.includes(userId));

    updatedOptions = poll.options.map(opt => {
      if (opt.id === optionId) {
        if (currentlyVoted) {
          return { ...opt, votes: opt.votes?.filter(v => v !== userId) || [] };
        }
        return { ...opt, votes: [...(opt.votes || []), userId] };
      }
      return { ...opt, votes: opt.votes?.filter(v => v !== userId) || [] };
    });
  }

  poll.options = updatedOptions;

  const newPolls = [...polls];
  newPolls[pollIndex] = poll;

  return { success: true, chat: { ...chat, polls: newPolls } };
}

export function buildToolInputSummary(toolName, args) {
  const labels = {
    run_code: args?.language ? `Running ${args.language} code…` : 'Executing code…',
    search_docs: `Searching docs: "${args?.query || ''}"`,
    analyze_code: 'Analyzing code…',
    web_search: `Searching: "${args?.query || ''}"`,
    sonar_search: `Web search: "${args?.query || ''}"`,
    deep_research: `Deep research: "${args?.query || ''}"`,
    fact_check: `Fact-checking: "${args?.claim || ''}"`,
    cite_sources: 'Generating citations…',
    immersive_translate: `Translating to ${args?.targetLang || 'target language'}…`,
    detect_content_domain: 'Detecting content domain…',
    execute_math: `Computing: ${args?.expression || ''}`,
    check_prerequisites: `Checking prerequisites for "${args?.topic || ''}"`,
    generate_quiz: `Generating quiz on "${args?.topic || ''}"`,
    track_progress: `Tracking: ${args?.topic || ''} (${args?.status || ''})`,
    delegate_task: `Delegating to ${args?.agentId || 'agent'}…`,
    MEMORY_REQUEST: `Memory request → ${args?.target || ''}: "${args?.topic || ''}"`,
  };
  return labels[toolName] || `Running tool: ${toolName}…`;
}
