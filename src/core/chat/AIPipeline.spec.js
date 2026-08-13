import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callAI: vi.fn(),
  calculateTypingDelay: vi.fn(() => 0),
  getRandomDelay: vi.fn(() => 0),
  executeTool: vi.fn(),
  compressContext: vi.fn(),
  extractMemoriesAsync: vi.fn(),
  buildMemoryBlock: vi.fn(),
  buildGroupContextBlock: vi.fn(),
  tryProactiveImageGen: vi.fn(),
  analyzeContextForImageGen: vi.fn(() => ({ willTrigger: false })),
  buildSkillsSystemBlock: vi.fn(() => ''),
}));

vi.mock("../../features/chat/services/chatService", () => ({
  callAI: mocks.callAI,
  calculateTypingDelay: mocks.calculateTypingDelay,
  getRandomDelay: mocks.getRandomDelay,
  TRUNCATED_RESPONSE_MARKER: "[RESPONSE_TRUNCATED]",
}));

vi.mock("../../features/chat/services/toolService", () => ({
  executeTool: mocks.executeTool,
}));

vi.mock("../memory/ContextCompressor", () => ({
  compressContext: mocks.compressContext,
  extractMemoriesAsync: mocks.extractMemoriesAsync,
}));

vi.mock("../memory/MemoryInjector", () => ({
  buildMemoryBlock: mocks.buildMemoryBlock,
  buildGroupContextBlock: mocks.buildGroupContextBlock,
}));

vi.mock("../../services/proactiveImageService", () => ({
  tryProactiveImageGen: mocks.tryProactiveImageGen,
  analyzeContextForImageGen: mocks.analyzeContextForImageGen,
}));

vi.mock("../../services/minimaxSkillsManifest", () => ({
  buildSkillsSystemBlock: mocks.buildSkillsSystemBlock,
}));

import { AIPipeline, buildScholarSearchQuery, extractArithmeticExpression } from "./AIPipeline";

function createPipeline(options = {}) {
  const callbacks = {
    onTyping: vi.fn(),
    onEditing: vi.fn(),
    onMessage: vi.fn(),
    onStream: vi.fn(),
    onSchedule: vi.fn(),
    onLog: vi.fn(),
    onRecall: vi.fn(),
    onError: vi.fn(),
    onToolStart: vi.fn(() => 'tool-msg-1'),
    onToolEnd: vi.fn(),
  };
  const pipeline = new AIPipeline(callbacks, {
    enableRecallSimulation: false,
    random: () => 0.99,
    ...options,
  });
  pipeline._wait = vi.fn().mockResolvedValue(undefined);
  return { pipeline, callbacks };
}

const personas = [
  {
    id: "ai-1",
    name: "Luna",
    personality: "gentle",
    style: "casual",
    typingSpeed: "normal",
    agentType: "task-specialist",
    toolsEnabled: true,
    tools: [{ name: "execute_math" }],
    memory: { enabled: true, longTermEnabled: true },
  },
];

const baseChat = {
  id: "chat-1",
  polls: [{ id: "poll-1", question: "Pick one", options: [{ text: "A" }] }],
  messages: [
    {
      id: "m1",
      senderId: "user-me",
      content: "hello",
      timestamp: "2026-02-23T00:00:00.000Z",
    },
  ],
};

describe("AIPipeline", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mockFn) => mockFn.mockReset());
    mocks.calculateTypingDelay.mockReturnValue(0);
    mocks.getRandomDelay.mockReturnValue(0);
    mocks.compressContext.mockReturnValue({
      compressed: false,
      messages: baseChat.messages,
    });
    mocks.buildMemoryBlock.mockResolvedValue("");
    mocks.buildGroupContextBlock.mockReturnValue("");
  });

  it("test_when_trigger_ai_not_found_should_exit_early", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();

    // When
    await pipeline.processTurn(baseChat, personas, { id: "not-found" });

    // Then
    expect(callbacks.onTyping).not.toHaveBeenCalled();
    expect(mocks.callAI).not.toHaveBeenCalled();
  });

  it("test_when_call_ai_returns_null_should_stop_typing", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValue(null);

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith("chat-1", "ai-1", true);
    expect(callbacks.onTyping).toHaveBeenCalledWith("chat-1", "ai-1", false);
    expect(callbacks.onMessage).not.toHaveBeenCalled();
  });

  it("test_when_provider_fails_should_report_a_retryable_turn_error", async () => {
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockImplementationOnce((_messages, options) => {
      options.onError?.({ code: "http_error", status: 504 });
      return Promise.resolve(null);
    });

    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    expect(callbacks.onError).toHaveBeenCalledWith(
      "chat-1",
      "ai-1",
      expect.objectContaining({
        code: "http_error",
        status: 504,
        userMessageId: "m1",
      }),
    );
  });

  it("test_when_normal_chat_has_agent_tools_should_use_exactly_one_llm_call_without_tool_schemas", async () => {
    const { pipeline } = createPipeline();
    mocks.callAI.mockResolvedValueOnce("好的，我们继续聊。");

    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    expect(mocks.executeTool).not.toHaveBeenCalled();
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
    expect(mocks.callAI.mock.calls[0][1]).toEqual(expect.objectContaining({
      maxTokens: 3000,
      temperature: 0.4,
      stream: true,
      tools: undefined,
      toolChoice: undefined,
      disableReasoning: true,
    }));
  });

  it("test_when_social_persona_replies_should_stream_without_adding_a_request", async () => {
    const { pipeline, callbacks } = createPipeline();
    const socialPersona = {
      ...personas[0],
      agentType: "social-companion",
      toolsEnabled: false,
      tools: [],
    };
    mocks.callAI.mockImplementationOnce((_messages, options) => {
      options.onStreamChunk?.("先说", "先说结论");
      return Promise.resolve("先说结论");
    });

    await pipeline.processTurn(baseChat, [socialPersona], { id: "ai-1" });

    expect(mocks.callAI).toHaveBeenCalledTimes(1);
    expect(mocks.callAI.mock.calls[0][1].stream).toBe(true);
    expect(callbacks.onStream).toHaveBeenCalledWith("chat-1", "ai-1", "先说结论");
    expect(callbacks.onMessage).toHaveBeenCalledWith("chat-1", "先说结论", "ai-1");
  });

  it("test_when_explicit_math_request_should_answer_locally_without_an_llm_call", async () => {
    const { pipeline, callbacks } = createPipeline();
    const chat = {
      ...baseChat,
      messages: [{ ...baseChat.messages[0], content: "帮我计算 3 * 27 - 15" }],
    };
    mocks.executeTool.mockResolvedValueOnce("[Math Result]\nExpression: 3 * 27 - 15\nResult: 66");

    await pipeline.processTurn(chat, personas, { id: "ai-1" });

    expect(mocks.executeTool).toHaveBeenCalledWith(
      "execute_math",
      { expression: "3 * 27 - 15" },
      { personas, requesterId: "ai-1", delegationDepth: 0 },
    );
    expect(mocks.callAI).not.toHaveBeenCalled();
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      "工具计算结果：`66`（3 × 27 - 15）。",
      "ai-1",
    );
  });

  it("test_when_direct_math_has_a_symbolic_form_should_preserve_it_without_an_llm_call", async () => {
    const { pipeline, callbacks } = createPipeline();
    const chat = {
      ...baseChat,
      messages: [{ ...baseChat.messages[0], content: "请计算 2 * 3" }],
    };
    mocks.executeTool.mockResolvedValueOnce(
      "[Math Result]\nExpression: 2 * 3\nResult: 6\nSimplified: 2 * 3",
    );

    await pipeline.processTurn(chat, personas, { id: "ai-1" });

    expect(mocks.callAI).not.toHaveBeenCalled();
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      "工具计算结果：`6`；精确形式：`2 * 3`（2 × 3）。",
      "ai-1",
    );
  });

  it("test_when_user_asks_natural_language_budget_should_compute_with_zero_llm_calls", async () => {
    const { pipeline } = createPipeline();
    const chat = {
      ...baseChat,
      messages: [{
        ...baseChat.messages[0],
        content: "我在算搬家纸箱预算，3箱每箱27元，再减15元优惠，最后多少钱？",
      }],
    };
    mocks.executeTool.mockResolvedValueOnce("[Math Result]\nResult: 66");

    await pipeline.processTurn(chat, personas, { id: "ai-1" });

    expect(mocks.executeTool).toHaveBeenCalledWith(
      "execute_math",
      { expression: "3 * 27 - 15" },
      { personas, requesterId: "ai-1", delegationDepth: 0 },
    );
    expect(mocks.callAI).not.toHaveBeenCalled();
  });

  it("test_when_math_wording_is_ambiguous_should_not_guess_an_expression", () => {
    expect(extractArithmeticExpression("帮我算一下这份复杂预算")).toBeNull();
    expect(extractArithmeticExpression("3 boxes at $27 each minus 15")).toBe("3 * 27 - 15");
    expect(extractArithmeticExpression(
      "我买了3箱苹果，每箱27个，送给邻居15个，还剩多少？",
    )).toBe("3 * 27 - 15");
  });

  it("test_when_user_asks_a_natural_language_inventory_problem_should_use_zero_llm_calls", async () => {
    const { pipeline } = createPipeline();
    const chat = {
      ...baseChat,
      messages: [{
        ...baseChat.messages[0],
        content: "我买了3箱苹果，每箱27个，送给邻居15个，还剩多少？请直接告诉我结果。",
      }],
    };
    mocks.executeTool.mockResolvedValueOnce("[Math Result]\nExpression: 3 * 27 - 15\nResult: 66");

    await pipeline.processTurn(chat, personas, { id: "ai-1" });

    expect(mocks.executeTool).toHaveBeenCalledWith(
      "execute_math",
      { expression: "3 * 27 - 15" },
      { personas, requesterId: "ai-1", delegationDepth: 0 },
    );
    expect(mocks.callAI).not.toHaveBeenCalled();
  });

  it("test_when_openrouter_free_router_is_compared_should_use_a_precise_official_search_query", () => {
    expect(buildScholarSearchQuery(
      "请用 OpenRouter 官方资料比较 free router 和固定 :free 模型",
    )).toBe(
      "OpenRouter Free Models Router openrouter/free versus :free model variant official documentation",
    );
    expect(buildScholarSearchQuery("查询今天的天气")).toBe("查询今天的天气");
  });

  it("test_when_history_contains_recalled_or_error_messages_should_exclude_them_from_context", async () => {
    const { pipeline } = createPipeline();
    const chat = {
      ...baseChat,
      messages: [
        baseChat.messages[0],
        { id: "draft", senderId: "ai-1", content: "discarded", recalled: true },
        { id: "error", senderId: "ai-1", content: "failed", type: "ai_error" },
        { id: "m2", senderId: "user-me", content: "continue" },
      ],
    };
    mocks.compressContext.mockImplementationOnce((messages) => ({ compressed: false, messages }));
    mocks.callAI.mockResolvedValueOnce("answer");

    await pipeline.processTurn(chat, personas, { id: "ai-1" });

    expect(mocks.compressContext).toHaveBeenCalledWith(
      [baseChat.messages[0], chat.messages[3]],
      personas,
    );
  });

  it("test_when_text_tool_marker_appears_should_execute_once_and_return_result_without_second_llm", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.executeTool.mockResolvedValue("tool output");
    mocks.callAI.mockResolvedValueOnce('[TOOL_CALL: execute_math {"expression":"1+1"}]');

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(mocks.executeTool).toHaveBeenCalledWith(
      "execute_math",
      { expression: "1+1" },
      { personas, requesterId: "ai-1", delegationDepth: 0 },
    );
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      "tool output",
      "ai-1",
    );
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
  });

  it("test_when_model_requests_another_model_backed_tool_should_block_the_hidden_request", async () => {
    const { pipeline, callbacks } = createPipeline();
    const muse = {
      ...personas[0],
      tools: [{ name: "check_grammar" }],
    };
    mocks.callAI.mockResolvedValueOnce('[TOOL_CALL: check_grammar {"text":"hello"}]');

    await pipeline.processTurn(baseChat, [muse], { id: "ai-1" });

    expect(mocks.executeTool).not.toHaveBeenCalled();
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.stringContaining("additional hidden model workflow"),
      "ai-1",
    );
  });

  it("test_when_tools_are_disabled_should_reject_text_tool_call_without_execution", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    const disabledPersonas = [{ ...personas[0], toolsEnabled: false }];
    mocks.callAI.mockResolvedValueOnce('[TOOL_CALL: execute_math {"expression":"1+1"}]');

    // When
    await pipeline.processTurn(baseChat, disabledPersonas, { id: "ai-1" });

    // Then
    expect(mocks.executeTool).not.toHaveBeenCalled();
    expect(callbacks.onToolStart).not.toHaveBeenCalled();
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.stringContaining("工具执行失败"),
      "ai-1",
    );
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
  });

  it("test_when_tool_is_not_declared_should_reject_native_tool_call_without_execution", async () => {
    // Given
    const { pipeline } = createPipeline();
    const nativePayload = JSON.stringify({
      function: { name: "run_code", arguments: JSON.stringify({ code: "fetch('/')" }) },
    });
    mocks.callAI
      .mockResolvedValueOnce(`[TOOL_CALL_NATIVE:${nativePayload}]`)
      .mockResolvedValueOnce("native tool was denied");

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(mocks.executeTool).not.toHaveBeenCalled();
  });

  it("test_when_native_tool_response_contains_multiple_calls_should_execute_then_synthesize_once", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    const nativePayload = JSON.stringify([
      {
        function: {
          name: "execute_math",
          arguments: JSON.stringify({ expression: "1+1" }),
        },
      },
      {
        function: {
          name: "execute_math",
          arguments: JSON.stringify({ expression: "2+2" }),
        },
      },
    ]);
    mocks.executeTool
      .mockResolvedValueOnce("2")
      .mockResolvedValueOnce("4");
    mocks.callAI
      .mockResolvedValueOnce(`[TOOL_CALL_NATIVE:${nativePayload}]`)
      .mockResolvedValueOnce("The verified results are 2 and 4.");

    // When
    await pipeline.processTurn({
      ...baseChat,
      messages: [{ ...baseChat.messages[0], content: "帮我计算这两个表达式的结果" }],
    }, personas, { id: "ai-1" });

    // Then
    expect(mocks.executeTool).toHaveBeenNthCalledWith(
      1,
      "execute_math",
      { expression: "1+1" },
      { personas, requesterId: "ai-1", delegationDepth: 0 },
    );
    expect(mocks.executeTool).toHaveBeenNthCalledWith(
      2,
      "execute_math",
      { expression: "2+2" },
      { personas, requesterId: "ai-1", delegationDepth: 0 },
    );
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      "The verified results are 2 and 4.",
      "ai-1",
    );
    expect(mocks.callAI).toHaveBeenCalledTimes(2);
    expect(mocks.callAI.mock.calls[0][1].tools).toHaveLength(1);
    expect(mocks.callAI.mock.calls[1][1].tools).toBeUndefined();
    expect(mocks.callAI.mock.calls[1][0].at(-1).content)
      .toContain("distinguish area, circumference, and volume");
    expect(mocks.callAI.mock.calls[1][0].at(-1).content)
      .toContain("Quote the full value after `Result:`");
    expect(callbacks.onToolStart).toHaveBeenNthCalledWith(
      1,
      "chat-1",
      "ai-1",
      "execute_math",
      { expression: "1+1" },
    );
    expect(callbacks.onToolEnd).toHaveBeenNthCalledWith(
      1,
      "chat-1",
      "tool-msg-1",
      "2",
      null,
    );
  });

  it("test_when_native_tool_execution_throws_should_report_error_and_continue", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    const nativePayload = JSON.stringify({
      function: {
        name: "execute_math",
        arguments: JSON.stringify({ expression: "bad()" }),
      },
    });
    mocks.executeTool.mockRejectedValueOnce(new Error("tool failed"));
    mocks.callAI.mockResolvedValueOnce(`[TOOL_CALL_NATIVE:${nativePayload}]`);

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onToolEnd).toHaveBeenCalledWith(
      "chat-1",
      "tool-msg-1",
      null,
      "tool failed",
    );
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.stringContaining("工具执行失败：tool failed"),
      "ai-1",
    );
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
  });

  it("test_when_tool_call_json_is_invalid_should_report_locally_without_retrying_llm", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValueOnce("[TOOL_CALL: execute_math {oops}]");

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.stringContaining("工具执行失败"),
      "ai-1",
    );
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
  });

  it("test_when_memory_request_marker_appears_should_return_local_result_without_second_llm", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.executeTool.mockResolvedValue("memory result");
    mocks.callAI.mockResolvedValueOnce("[MEMORY_REQUEST: target=Luna, topic=food]");

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(mocks.executeTool).toHaveBeenCalledWith(
      "MEMORY_REQUEST",
      { target: "Luna", topic: "food" },
      { personas, requesterId: "ai-1" },
    );
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      "memory result",
      "ai-1",
    );
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
  });

  it("test_when_response_contains_silence_should_not_send_message", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValue("[SILENCE]");

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onMessage).not.toHaveBeenCalled();
    expect(callbacks.onTyping).toHaveBeenCalledWith("chat-1", "ai-1", false);
  });

  it("test_when_response_contains_multi_and_schedule_should_emit_multiple_messages_and_schedule", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValue("[SCHEDULE:5][MULTI:first|second] tail");

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onSchedule).toHaveBeenCalledWith("chat-1", personas[0], 5);
    expect(callbacks.onMessage).toHaveBeenNthCalledWith(
      1,
      "chat-1",
      "first",
      "ai-1",
    );
    expect(callbacks.onMessage).toHaveBeenNthCalledWith(
      2,
      "chat-1",
      "second",
      "ai-1",
    );
    expect(callbacks.onMessage).toHaveBeenNthCalledWith(
      3,
      "chat-1",
      "tail",
      "ai-1",
    );
  });

  it("test_when_response_is_empty_should_stop_typing_without_sending_message", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValue("");

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith("chat-1", "ai-1", false);
    expect(callbacks.onMessage).not.toHaveBeenCalled();
  });

  it("test_when_context_is_compressed_should_capture_latest_memory_locally_without_extra_llm_call", async () => {
    // Given
    const { pipeline } = createPipeline();
    const manyMessages = Array.from({ length: 20 }, (_, idx) => ({
      id: `m-${idx}`,
      senderId: idx % 2 === 0 ? "user-me" : "ai-1",
      content: `msg-${idx}`,
      timestamp: `2026-02-23T00:${String(idx).padStart(2, "0")}:00.000Z`,
    }));
    mocks.compressContext.mockReturnValue({
      compressed: true,
      summary: "[summary]",
      recentMessages: manyMessages.slice(-8),
    });
    mocks.callAI.mockResolvedValue("done");

    // When
    await pipeline.processTurn(
      { ...baseChat, messages: manyMessages },
      personas,
      { id: "ai-1" },
    );

    // Then
    expect(mocks.extractMemoriesAsync).toHaveBeenCalledWith(
      [manyMessages.at(-2)],
      "ai-1",
      "Luna",
    );
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
  });

  it("test_when_context_is_long_should_toggle_editing_before_typing", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValue("done");
    const longChat = {
      ...baseChat,
      messages: [
        {
          id: "long-1",
          senderId: "user-me",
          content: "x".repeat(700),
          timestamp: "2026-02-23T00:00:00.000Z",
        },
      ],
    };

    // When
    await pipeline.processTurn(longChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onEditing).toHaveBeenNthCalledWith(1, "chat-1", "ai-1", true);
    expect(callbacks.onEditing).toHaveBeenNthCalledWith(2, "chat-1", "ai-1", false);
    expect(callbacks.onTyping).toHaveBeenCalledWith("chat-1", "ai-1", true);
  });

  it("test_when_persona_delays_are_large_should_cap_artificial_waits_for_live_chat", async () => {
    const { pipeline } = createPipeline();
    mocks.getRandomDelay
      .mockReturnValueOnce(8_000)
      .mockReturnValueOnce(8_000);
    mocks.callAI.mockResolvedValueOnce("done");

    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    expect(pipeline._wait.mock.calls[0][0]).toBeLessThanOrEqual(250);
    expect(pipeline._wait.mock.calls[1][0]).toBeLessThanOrEqual(500);
  });

  it("test_when_rendered_reply_is_long_should_cap_post_response_typing_delay", async () => {
    const { pipeline, callbacks } = createPipeline();
    mocks.calculateTypingDelay.mockReturnValueOnce(3_000);

    await pipeline._simulateTypingAndSend("chat-1", personas[0], "a long answer");

    expect(pipeline._wait).toHaveBeenCalledWith(1_200);
    expect(callbacks.onMessage).toHaveBeenCalledWith("chat-1", "a long answer", "ai-1");
  });

  it("test_when_memory_request_tool_throws_should_report_locally_without_second_llm", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.executeTool.mockRejectedValue(new Error("memory unavailable"));
    mocks.callAI.mockResolvedValueOnce("[MEMORY_REQUEST: target=Luna, topic=history]");

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.stringContaining("记忆请求失败：memory unavailable"),
      "ai-1",
    );
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
  });

  it("test_when_process_turn_dependencies_throw_should_catch_and_stop_typing", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();
    mocks.buildMemoryBlock.mockRejectedValue(new Error("memory db failed"));

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith("chat-1", "ai-1", false);
  });

  it("test_when_depth_exceeds_limit_should_stop_recursion", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();

    // When
    await pipeline._runReActLoop("chat-1", personas[0], "sys", [], 4, personas);

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith("chat-1", "ai-1", false);
    expect(mocks.callAI).not.toHaveBeenCalled();
  });

  it("test_when_handle_final_response_receives_null_should_only_stop_typing", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline();

    // When
    await pipeline._handleFinalResponse("chat-1", personas[0], null);

    // Then
    expect(callbacks.onTyping).toHaveBeenCalledWith("chat-1", "ai-1", false);
    expect(callbacks.onMessage).not.toHaveBeenCalled();
  });

  it("test_when_legacy_recall_option_is_enabled_should_still_keep_one_llm_request", async () => {
    // Given
    const { pipeline, callbacks } = createPipeline({
      enableRecallSimulation: true,
      random: () => 0,
    });
    mocks.callAI.mockResolvedValueOnce("draft reply");

    // When
    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    // Then
    expect(callbacks.onRecall).not.toHaveBeenCalled();
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      "draft reply",
      "ai-1",
    );
    expect(mocks.callAI).toHaveBeenCalledTimes(1);
  });

  it("test_when_prepare_history_starts_with_assistant_should_prepend_summary_user_message", () => {
    // Given
    const { pipeline } = createPipeline();
    const messages = [
      { id: "m2", senderId: "ai-1", content: "[POLL:poll-1]" },
      { id: "m3", senderId: "ai-1", content: "another" },
    ];

    // When
    const history = pipeline._prepareHistory(
      messages,
      personas,
      true,
      "[summary]",
      baseChat.polls,
    );

    // Then
    expect(history[0]).toEqual({ role: "user", content: "[summary]" });
    expect(history[1].content).toContain("Poll created");
  });

  it("test_when_recent_history_is_large_should_preserve_the_latest_user_message_verbatim", () => {
    const { pipeline } = createPipeline();
    const latest = "用户当前输入".repeat(5000);
    const messages = [
      ...Array.from({ length: 48 }, (_, index) => ({
        id: `old-${index}`,
        senderId: index % 2 === 0 ? "user-me" : "ai-1",
        content: `older-${index}-${"x".repeat(2000)}`,
      })),
      { id: "latest", senderId: "user-me", content: latest },
    ];

    const history = pipeline._prepareHistory(messages, personas, false, "", []);

    expect(history.at(-1)).toEqual({ role: "user", content: latest });
    expect(history.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(100000);
  });

  it("test_when_history_contains_media_should_replace_transport_payloads_with_semantic_markers", () => {
    const { pipeline } = createPipeline();
    const history = pipeline._prepareHistory([
      { senderId: "user-me", content: `[IMG:data:image/png;base64,${"A".repeat(10000)}]` },
      { senderId: "ai-1", content: "I can see that an image was shared." },
    ], personas, false, "", []);

    expect(history[0].content).toBe("[Image shared in chat]");
    expect(history[0].content).not.toContain("base64");
  });

  it("test_when_context_is_compressed_should_include_summary_even_if_recent_history_starts_with_user", () => {
    const { pipeline } = createPipeline();
    const history = pipeline._prepareHistory([
      { senderId: "user-me", content: "recent question" },
      { senderId: "ai-1", content: "recent answer" },
    ], personas, true, "[Earlier user context: durable preference]", []);

    expect(history[0].role).toBe("user");
    expect(history[0].content).toContain("Earlier user context");
    expect(history[0].content).toContain("recent question");
  });

  it("test_when_building_persona_prompt_should_prioritize_a_direct_answer_for_concrete_requests", () => {
    const { pipeline } = createPipeline();

    const prompt = pipeline._generateSystemPrompt(personas[0]);

    expect(prompt).toContain('lead with the answer or action');
  });

  it("test_when_user_requests_depth_should_not_apply_an_arbitrary_short_answer_rule", () => {
    const { pipeline } = createPipeline();
    const prompt = pipeline._generateSystemPrompt({
      id: "agent-coder",
      name: "Coder",
      agentType: "task-specialist",
      systemPrompt: "你是 Coder，负责完整解决编程问题。",
    }, {
      latestUserLanguage: "zh",
      latestUserText: "请详细分析根因并给出完整实现和验证步骤",
    });

    expect(prompt).toContain("完整");
    expect(prompt).toContain("cover every requested deliverable completely");
    expect(prompt).not.toContain("shortest complete answer");
    expect(prompt.match(/你是 Coder/g)).toHaveLength(1);
    expect(prompt).toContain("never expose a scratchpad");
    expect(pipeline._resolveOutputTokenLimit({ agentType: "social-companion" }, "请详细展开")).toBe(3000);
    expect(pipeline._resolveOutputTokenLimit({ id: "agent-coder", agentType: "task-specialist" }, "完整实现")).toBe(6144);
  });

  it("test_when_brevity_word_is_negated_should_keep_the_long_form_budget", () => {
    const { pipeline } = createPipeline();
    const request = "请完整回答，不要为了简短而省略实现细节";
    const prompt = pipeline._generateSystemPrompt({
      id: "agent-coder",
      name: "Coder",
      agentType: "task-specialist",
      systemPrompt: "你是 Coder。",
    }, { latestUserLanguage: "zh", latestUserText: request });

    expect(pipeline._resolveOutputTokenLimit(
      { id: "agent-coder", agentType: "task-specialist" },
      request,
    )).toBe(6144);
    expect(prompt).toContain("requested depth");
    expect(prompt).not.toContain("requested brevity");
  });

  it("test_when_specialist_streams_should_update_one_message_and_finalize_without_an_extra_request", async () => {
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockImplementationOnce((_messages, options) => {
      options.onStreamChunk?.("完整", "完整回答");
      return Promise.resolve("完整回答");
    });

    await pipeline.processTurn(baseChat, personas, { id: "ai-1" });

    expect(mocks.callAI).toHaveBeenCalledTimes(1);
    expect(callbacks.onStream).toHaveBeenCalledWith("chat-1", "ai-1", "完整回答");
    expect(callbacks.onMessage).toHaveBeenCalledWith("chat-1", "完整回答", "ai-1");
  });

  it("test_when_provider_truncates_should_preserve_partial_answer_with_an_honest_notice", async () => {
    const { pipeline, callbacks } = createPipeline();
    mocks.callAI.mockResolvedValueOnce("[RESPONSE_TRUNCATED]\n已完成的正文");
    const chat = {
      ...baseChat,
      messages: [{ ...baseChat.messages[0], content: "请详细回答" }],
    };

    await pipeline.processTurn(chat, personas, { id: "ai-1" });

    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.stringMatching(/已完成的正文[\s\S]*达到回复长度上限[\s\S]*没有隐藏重试/),
      "ai-1",
    );
  });

  it("test_when_tool_synthesis_truncates_immediately_should_keep_exact_local_result_without_retry", async () => {
    const { pipeline, callbacks } = createPipeline();
    const nativePayload = JSON.stringify({
      function: {
        name: "execute_math",
        arguments: JSON.stringify({ expression: "pi * 8.25^2" }),
      },
    });
    mocks.executeTool.mockResolvedValueOnce(
      "[Math Result]\nExpression: pi * 8.25^2\nResult: 213.82464914076954\nSimplified: 68.0625 * pi",
    );
    mocks.callAI
      .mockResolvedValueOnce(`[TOOL_CALL_NATIVE:${nativePayload}]`)
      .mockResolvedValueOnce("[RESPONSE_TRUNCATED]\n计");
    const chat = {
      ...baseChat,
      messages: [{ ...baseChat.messages[0], content: "我在计算圆的面积：圆周率乘以八点二五的平方是多少？" }],
    };

    await pipeline.processTurn(chat, personas, { id: "ai-1" });

    expect(mocks.callAI).toHaveBeenCalledTimes(2);
    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.stringMatching(/213\.82464914076954[\s\S]*68\.0625 \* pi[\s\S]*半径为 `8\.25`[\s\S]*没有隐藏重试/),
      "ai-1",
    );
    expect(callbacks.onMessage.mock.calls.at(-1)[1]).not.toMatch(/\n\n计\n/);
  });

  it("test_when_tool_synthesis_stops_after_one_character_should_replace_it_with_verified_context", async () => {
    const { pipeline, callbacks } = createPipeline();

    await pipeline._handleFinalResponse("chat-1", personas[0], "工", [], {
      language: "zh",
      latestUserText: "请计算半径 7.75 的圆形地毯面积",
      lastToolName: "execute_math",
      lastToolOutput: "[Math Result]\nExpression: pi * 7.75^2\nResult: 188.69190875623696\nSimplified: 60.0625 * pi",
    });

    expect(callbacks.onMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.stringMatching(/188\.69190875623696[\s\S]*60\.0625 \* pi[\s\S]*半径为 `7\.75`[\s\S]*没有隐藏重试/),
      "ai-1",
    );
    expect(callbacks.onMessage.mock.calls.at(-1)[1]).not.toContain("\n\n工");
  });

  it("test_when_tool_result_is_only_a_prefix_of_model_number_should_restore_the_exact_value", () => {
    const { pipeline } = createPipeline();

    const response = pipeline._ensureAuthoritativeToolFacts("The rounded result is 10.", {
      language: "en",
      lastToolName: "execute_math",
      lastToolOutput: "[Math Result]\nExpression: 1\nResult: 1",
    });

    expect(response).toMatch(/^Verified tool result: `1`\./);
    expect(response).toContain("The rounded result is 10.");
  });

  it("test_when_current_information_is_not_requested_should_omit_unrelated_freshness_rules", () => {
    const { pipeline } = createPipeline();
    const casual = pipeline._generateSystemPrompt(personas[0], { latestUserText: "我今天有点累" });
    const current = pipeline._generateSystemPrompt(personas[0], { latestUserText: "今天最新价格是多少" });

    expect(casual).not.toContain("time-sensitive facts");
    expect(current).toContain("time-sensitive facts");
  });

  it("test_when_generate_system_prompt_uses_context_should_emit_relationship_and_mood_without_tool_manifest", () => {
    // Given
    const { pipeline } = createPipeline();
    const socialPersona = { ...personas[0], agentType: 'social' };

    // When
    const soulmate = pipeline._generateSystemPrompt(
      socialPersona,
      { intimacyLevel: 5, mood: { promptHint: "happy" } },
      "\nMEMORY\n",
      "\nGROUP\n",
    );
    const closeFriend = pipeline._generateSystemPrompt(
      socialPersona,
      { intimacyLevel: 4 },
      "",
      "",
    );
    const goodFriend = pipeline._generateSystemPrompt(
      socialPersona,
      { intimacyLevel: 3 },
      "",
      "",
    );
    const friend = pipeline._generateSystemPrompt(
      socialPersona,
      { intimacyLevel: 2 },
      "",
      "",
    );
    const acquaintance = pipeline._generateSystemPrompt(
      socialPersona,
      { intimacyLevel: 1 },
      "",
      "",
    );

    // Then
    expect(soulmate).toContain("RELATIONSHIP: soulmate");
    expect(soulmate).toContain("CURRENT MOOD: happy");
    expect(soulmate).not.toContain("TOOL_CALL");
    expect(soulmate).not.toContain("MINIMAX MULTIMODAL SKILLS");
    expect(closeFriend).toContain("RELATIONSHIP: close friend");
    expect(goodFriend).toContain("RELATIONSHIP: good friend");
    expect(friend).toContain("RELATIONSHIP: friend");
    expect(acquaintance).toContain("RELATIONSHIP: acquaintance");
  });

  it("test_when_task_specialist_prompt_is_built_should_omit_social_mood_tokens", () => {
    const { pipeline } = createPipeline();
    const prompt = pipeline._generateSystemPrompt(
      personas[0],
      { intimacyLevel: 5, mood: { promptHint: "happy" } },
    );

    expect(prompt).not.toContain("RELATIONSHIP:");
    expect(prompt).not.toContain("CURRENT MOOD:");
  });

  it("test_when_generate_system_prompt_without_optional_context_should_keep_base_rules_only", () => {
    // Given
    const { pipeline } = createPipeline();

    // When
    const prompt = pipeline._generateSystemPrompt(
      {
        id: "ai-x",
        name: "Edge",
        personality: "calm",
        style: "brief",
        agentType: "companion",
      },
      null,
      "",
      "",
    );

    // Then
    expect(prompt).toContain("You are Edge");
    expect(prompt).toContain("keep casual chat natural, but do not omit useful substance");
    expect(prompt.includes("RELATIONSHIP:")).toBe(false);
    expect(prompt.includes("CURRENT MOOD:")).toBe(false);
  });

  it("test_when_log_has_no_callback_should_fallback_to_console_log", () => {
    // Given
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const pipeline = new AIPipeline({}, { enableRecallSimulation: false });

    // When
    pipeline.log("hello", { x: 1 });

    // Then
    expect(consoleSpy).toHaveBeenCalledWith("hello", { x: 1 });
    consoleSpy.mockRestore();
  });

  it("test_when_build_native_tools_for_ai_receives_disabled_or_missing_tools_should_return_null", () => {
    // Given
    const { pipeline } = createPipeline();

    // When
    const disabled = pipeline._buildNativeToolsForAI({ toolsEnabled: false, tools: [{ name: "x" }] });
    const empty = pipeline._buildNativeToolsForAI({ toolsEnabled: true, tools: [] });

    // Then
    expect(disabled).toBeNull();
    expect(empty).toBeNull();
  });

  it("test_when_build_native_tools_for_ai_detects_matching_intent_should_fill_defaults", () => {
    // Given
    const { pipeline } = createPipeline();

    // When
    const tools = pipeline._buildNativeToolsForAI({
      toolsEnabled: true,
      tools: [{ name: "execute_math" }],
    }, "请计算 3 * 27");

    // Then
    expect(tools).toEqual([
      {
        type: "function",
        function: {
          name: "execute_math",
          description: "Tool: execute_math",
          parameters: {
            type: "object",
            properties: {
              expression: {
                type: "string",
                minLength: 1,
                description: "A math.js-compatible expression derived from the user request",
              },
            },
            required: ["expression"],
            additionalProperties: false,
          },
        },
      },
    ]);
  });

  it("test_when_parse_native_tool_marker_is_malformed_should_return_null_or_empty_args", () => {
    // Given
    const { pipeline } = createPipeline();

    // When
    const malformed = pipeline._parseNativeToolMarker("[TOOL_CALL_NATIVE:not-json]");
    const parsed = pipeline._parseNativeToolMarker(
      `[TOOL_CALL_NATIVE:${JSON.stringify({ function: { name: "lookup", arguments: "{oops}" } })}]`,
    );

    // Then
    expect(malformed).toBeNull();
    expect(parsed).toEqual([{
      name: "lookup",
      args: {
        error: 'JSON_PARSE_FAILED',
        details: expect.stringContaining("JSON")
      }
    }]);
  });

  it("test_when_parse_native_tool_marker_uses_object_arguments_should_preserve_object_payload", () => {
    // Given
    const { pipeline } = createPipeline();

    // When
    const parsed = pipeline._parseNativeToolMarker(
      `[TOOL_CALL_NATIVE:${JSON.stringify({ function: { name: "lookup", arguments: { query: "moon" } } })}]`,
    );

    // Then
    expect(parsed).toEqual([{ name: "lookup", args: { query: "moon" } }]);
  });

  it("test_when_detect_latest_user_language_checks_text_mix_should_return_expected_language", () => {
    // Given
    const { pipeline } = createPipeline();

    // When
    const english = pipeline._detectLatestUserLanguage([
      { senderId: "user-me", content: "hello there" },
    ]);
    const chinese = pipeline._detectLatestUserLanguage([
      { senderId: "user-me", content: "你好世界" },
    ]);
    const mixed = pipeline._detectLatestUserLanguage([
      { senderId: "user-me", content: "你好he" },
    ]);
    const chineseWithCode = pipeline._detectLatestUserLanguage([
      { senderId: "user-me", content: "请修复这个函数：function first(xs) { return xs[1]; }" },
    ]);
    const englishWithChineseQuote = pipeline._detectLatestUserLanguage([
      { senderId: "user-me", content: "What does 你好 mean in English?" },
    ]);
    const none = pipeline._detectLatestUserLanguage([
      { senderId: "ai-1", content: "assistant only" },
    ]);

    // Then
    expect(english).toBe("en");
    expect(chinese).toBe("zh");
    expect(mixed).toBe("zh");
    expect(chineseWithCode).toBe("zh");
    expect(englishWithChineseQuote).toBe("en");
    expect(none).toBeNull();
  });

  it("test_when_should_simulate_recall_receives_blank_or_disabled_response_should_return_false", () => {
    // Given
    const { pipeline } = createPipeline({ enableRecallSimulation: true, random: () => 0 });
    const disabled = new AIPipeline({}, { enableRecallSimulation: false, random: () => 0 });

    // When / Then
    expect(pipeline._shouldSimulateRecall("   ")).toBe(false);
    expect(disabled._shouldSimulateRecall("hello")).toBe(false);
  });

  it("test_when_tool_intent_is_absent_should_not_send_tool_schemas", () => {
    const { pipeline } = createPipeline();

    const result = pipeline._buildNativeToolsForAI({
      toolsEnabled: true,
      tools: [{ name: "execute_math" }],
    }, "今天心情不错");

    expect(result).toBeNull();
  });
});
