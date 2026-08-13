import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../test/msw/server';

const mockConfig = {
  apiKey: 'test-api-key',
  model: 'mock-model',
  baseUrl: 'https://mock.api',
};

vi.mock('../../../services/api/aiClient', () => {
  return {
    getAIClient: () => ({
      baseURL: 'https://mock.api',
      post: async (endpoint, body) => {
        return fetch('https://mock.api' + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      },
    }),
    getAIConfiguration: () => mockConfig,
  };
});

import {
  callAI,
  cleanMessageContent,
  calculateTypingDelay,
  getRandomDelay,
} from './chatService';

describe('chatService.callAI', () => {
  beforeEach(() => {
    mockConfig.apiKey = 'test-api-key';
    mockConfig.model = 'mock-model';
    mockConfig.baseUrl = 'https://mock.api';
  });

  it('test_when_api_key_missing_should_return_null', async () => {
    // Given
    mockConfig.apiKey = '';

    // When
    const result = await callAI([{ role: 'user', content: 'hello' }]);

    // Then
    expect(result).toBeNull();
  });

  it('test_when_system_prompt_exists_should_prepend_or_merge_system_message', async () => {
    // Given
    const capturedBodies = [];
    server.use(
      http.post('*/chat/completions', async ({ request }) => {
        capturedBodies.push(await request.json());
        return HttpResponse.json({
          choices: [{ message: { content: 'ok' } }],
        });
      })
    );

    // When
    await callAI(
      [{ role: 'user', content: 'normal message' }],
      { systemPrompt: 'SYS_A' }
    );
    await callAI(
      [{ role: 'system', content: 'existing system' }, { role: 'user', content: 'hello' }],
      { systemPrompt: 'SYS_B' }
    );

    // Then
    expect(capturedBodies).toHaveLength(2);
    expect(capturedBodies[0].messages[0]).toEqual({ role: 'system', content: 'SYS_A' });
    expect(capturedBodies[0].messages[1].role).toBe('user');
    expect(capturedBodies[1].messages[0].content).toContain('SYS_B');
    expect(capturedBodies[1].messages[0].content).toContain('existing system');
  });

  it('test_when_api_returns_error_should_return_null', async () => {
    // Given
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          error: { message: 'bad request' },
        })
      )
    );

    // When
    const result = await callAI([{ role: 'user', content: 'hello' }], { agentId: 'ai-1' });

    // Then
    expect(result).toBeNull();
  });

  it('test_when_openrouter_returns_choice_level_provider_error_should_report_it', async () => {
    const onError = vi.fn();
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          choices: [{
            finish_reason: 'error',
            error: { code: 502, message: 'Upstream provider unavailable' },
            message: { role: 'assistant', content: null },
          }],
        })
      )
    );

    const result = await callAI(
      [{ role: 'user', content: 'hello' }],
      { onError }
    );

    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith({
      code: 'provider_error',
      status: 502,
      message: 'Upstream provider unavailable',
    });
  });

  it('test_when_choices_empty_should_return_null', async () => {
    // Given
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          choices: [],
        })
      )
    );

    // When
    const result = await callAI([{ role: 'user', content: 'hello' }]);

    // Then
    expect(result).toBeNull();
  });

  it('test_when_network_throws_should_return_null', async () => {
    // Given
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network fail'));

    // When
    const result = await callAI([{ role: 'user', content: 'hello' }], { agentId: 'ai-2' });

    // Then
    expect(result).toBeNull();
    fetchSpy.mockRestore();
  });

  it('test_when_max_tokens_and_model_override_are_provided_should_keep_single_configured_model', async () => {
    // Given
    const capturedBodies = [];
    server.use(
      http.post('*/chat/completions', async ({ request }) => {
        capturedBodies.push(await request.json());
        return HttpResponse.json({
          choices: [{ message: { content: 'ok with max tokens' } }],
        });
      })
    );

    // When
    const result = await callAI(
      [{ role: 'user', content: 'hello' }],
      { model: 'custom-model', maxTokens: 2048, temperature: 0.1 }
    );

    // Then
    expect(result).toBe('ok with max tokens');
    expect(capturedBodies[0].model).toBe('mock-model');
    expect(capturedBodies[0].max_tokens).toBe(2048);
    expect(capturedBodies[0].temperature).toBe(0.1);
  });

  it('test_when_openrouter_utility_request_disables_reasoning_should_send_supported_switch', async () => {
    const capturedBodies = [];
    mockConfig.baseUrl = 'https://openrouter.ai/api/v1';
    server.use(
      http.post('*/chat/completions', async ({ request }) => {
        capturedBodies.push(await request.json());
        return HttpResponse.json({ choices: [{ message: { content: 'Short title' } }] });
      })
    );

    await callAI(
      [{ role: 'user', content: 'name this chat' }],
      { maxTokens: 32, disableReasoning: true }
    );

    expect(capturedBodies[0].reasoning).toEqual({ effort: 'none', exclude: true });
  });

  it('test_when_non_openrouter_request_disables_reasoning_should_not_send_provider_specific_field', async () => {
    const capturedBodies = [];
    server.use(
      http.post('*/chat/completions', async ({ request }) => {
        capturedBodies.push(await request.json());
        return HttpResponse.json({ choices: [{ message: { content: 'Short title' } }] });
      })
    );

    await callAI(
      [{ role: 'user', content: 'name this chat' }],
      { maxTokens: 32, disableReasoning: true }
    );

    expect(capturedBodies[0]).not.toHaveProperty('reasoning');
  });

  it('test_when_base_url_requires_v1_path_should_retry_with_v1_chat_completions', async () => {
    // Given
    let plainPathCalls = 0;
    let v1PathCalls = 0;

    server.use(
      http.post('https://mock.api/chat/completions', () => {
        plainPathCalls += 1;
        return HttpResponse.json({ error: { message: 'not found' } }, { status: 404 });
      }),
      http.post('https://mock.api/v1/chat/completions', () => {
        v1PathCalls += 1;
        return HttpResponse.json({
          choices: [{ message: { content: 'ok via v1' } }],
        });
      })
    );

    // When
    const result = await callAI([{ role: 'user', content: 'hello' }]);

    // Then
    expect(result).toBe('ok via v1');
    expect(plainPathCalls).toBe(1);
    expect(v1PathCalls).toBe(1);
  });

  it('test_when_message_content_is_structured_array_should_extract_text_content', async () => {
    // Given
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          choices: [
            {
              message: {
                content: [
                  { type: 'text', text: 'hello ' },
                  { type: 'output_text', text: 'world' },
                ],
              },
            },
          ],
        })
      )
    );

    // When
    const result = await callAI([{ role: 'user', content: 'hello' }]);

    // Then
    expect(result).toBe('hello world');
  });

  it('test_when_native_tools_are_provided_should_send_tools_and_tool_choice', async () => {
    // Given
    const capturedBodies = [];
    server.use(
      http.post('*/chat/completions', async ({ request }) => {
        capturedBodies.push(await request.json());
        return HttpResponse.json({
          choices: [{ message: { content: 'ok' } }],
        });
      })
    );

    const tools = [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search web',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];

    // When
    const result = await callAI(
      [{ role: 'user', content: 'search this' }],
      { tools, toolChoice: 'auto' }
    );

    // Then
    expect(result).toBe('ok');
    expect(capturedBodies[0].tools).toEqual(tools);
    expect(capturedBodies[0].tool_choice).toBe('auto');
  });

  it('test_when_response_contains_native_tool_calls_should_return_native_tool_marker', async () => {
    // Given
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'execute_math', arguments: '{"expression":"1+1"}' },
                  },
                ],
              },
            },
          ],
        })
      )
    );

    // When
    const result = await callAI([{ role: 'user', content: 'use tool' }]);

    // Then
    expect(result).toContain('[TOOL_CALL_NATIVE:');
    expect(result).toContain('"execute_math"');
  });

  it('test_when_tool_call_also_contains_reasoning_text_should_prioritize_the_tool_call', async () => {
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          choices: [{
            finish_reason: 'tool_calls',
            message: {
              content: 'I should calculate this first.',
              reasoning: 'I should calculate this first.',
              tool_calls: [{
                id: 'call_2',
                type: 'function',
                function: { name: 'execute_math', arguments: '{"expression":"pi*12^2"}' },
              }],
            },
          }],
        })
      )
    );

    const result = await callAI([{ role: 'user', content: 'calculate this' }]);

    expect(result).toContain('[TOOL_CALL_NATIVE:');
    expect(result).toContain('execute_math');
    expect(result).not.toContain('I should calculate');
  });

  it('test_when_provider_duplicates_reasoning_as_content_should_not_expose_it', async () => {
    const onError = vi.fn();
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          choices: [{
            finish_reason: 'length',
            message: {
              content: "Here's a thinking process: private scratchpad",
              reasoning: "Here's a thinking process: private scratchpad",
            },
          }],
        })
      )
    );

    const result = await callAI([{ role: 'user', content: 'solve this' }], { onError });

    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith({
      code: 'reasoning_only_response',
      finishReason: 'length',
    });
  });

  it('test_when_final_answer_hits_the_length_limit_should_preserve_it_with_a_marker', async () => {
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          choices: [{
            finish_reason: 'length',
            message: { content: 'A useful but incomplete final answer' },
          }],
        })
      )
    );

    const result = await callAI([{ role: 'user', content: 'solve this' }]);

    expect(result).toBe('[RESPONSE_TRUNCATED]\nA useful but incomplete final answer');
  });

  it('test_when_response_contains_legacy_function_call_should_return_native_tool_marker', async () => {
    // Given
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          choices: [
            {
              message: {
                function_call: { name: 'legacy_lookup', arguments: '{"query":"moon"}' },
              },
            },
          ],
        })
      )
    );

    // When
    const result = await callAI([{ role: 'user', content: 'legacy tool' }]);

    // Then
    expect(result).toContain('[TOOL_CALL_NATIVE:');
    expect(result).toContain('legacy_lookup');
  });

  it('test_when_responses_api_output_exists_should_extract_fallback_text', async () => {
    // Given
    server.use(
      http.post('*/chat/completions', () =>
        HttpResponse.json({
          output: [
            { content: [{ type: 'output_text', text: 'hello ' }] },
            { content: [{ type: 'text', text: 'world' }] },
          ],
        })
      )
    );

    // When
    const result = await callAI([{ role: 'user', content: 'responses output' }]);

    // Then
    expect(result).toBe('hello world');
  });

  it('test_when_streaming_sse_text_should_accumulate_chunks_and_emit_deltas', async () => {
    // Given
    const onStreamChunk = vi.fn();
    const frames = [
      'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream({
      start(controller) {
        frames.forEach((frame) => controller.enqueue(new TextEncoder().encode(frame)));
        controller.close();
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }));

    // When
    const result = await callAI(
      [{ role: 'user', content: 'stream please' }],
      { stream: true, onStreamChunk }
    );

    // Then
    expect(result).toBe('Hello world');
    expect(onStreamChunk).toHaveBeenNthCalledWith(1, 'Hello ', 'Hello ', expect.any(Object));
    expect(onStreamChunk).toHaveBeenNthCalledWith(2, 'world', 'Hello world', expect.any(Object));
    fetchSpy.mockRestore();
  });

  it('test_when_streaming_sse_contains_only_tool_calls_should_return_native_tool_marker', async () => {
    // Given
    const frames = [
      'data: {"choices":[{"message":{"tool_calls":[{"id":"call_1","type":"function","function":{"name":"web_search","arguments":"{\\"query\\":\\"news\\"}"}}]}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream({
      start(controller) {
        frames.forEach((frame) => controller.enqueue(new TextEncoder().encode(frame)));
        controller.close();
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }));

    // When
    const result = await callAI([{ role: 'user', content: 'tool stream' }], { stream: true });

    // Then
    expect(result).toContain('[TOOL_CALL_NATIVE:');
    expect(result).toContain('web_search');
    fetchSpy.mockRestore();
  });

  it('test_when_streaming_sse_contains_malformed_frames_should_ignore_them_and_keep_valid_text', async () => {
    // Given
    const frames = [
      'data: {not-json}\n\n',
      'data: {"choices":[{"delta":{"content":"still works"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream({
      start(controller) {
        frames.forEach((frame) => controller.enqueue(new TextEncoder().encode(frame)));
        controller.close();
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }));

    // When
    const result = await callAI([{ role: 'user', content: 'mixed stream' }], { stream: true });

    // Then
    expect(result).toBe('still works');
    fetchSpy.mockRestore();
  });

  it('test_when_streaming_answer_hits_length_should_preserve_partial_content', async () => {
    const frames = [
      'data: {"choices":[{"delta":{"content":"Useful partial"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream({
      start(controller) {
        frames.forEach((frame) => controller.enqueue(new TextEncoder().encode(frame)));
        controller.close();
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }));

    const result = await callAI([{ role: 'user', content: 'stream long answer' }], { stream: true });

    expect(result).toBe('[RESPONSE_TRUNCATED]\nUseful partial');
    fetchSpy.mockRestore();
  });

  it('test_when_streaming_content_is_a_reasoning_trace_should_hide_it', async () => {
    const onError = vi.fn();
    const frames = [
      'data: {"choices":[{"delta":{"content":"Here\\u0027s a thinking process: private"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream({
      start(controller) {
        frames.forEach((frame) => controller.enqueue(new TextEncoder().encode(frame)));
        controller.close();
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }));

    const result = await callAI(
      [{ role: 'user', content: 'stream safely' }],
      { stream: true, onError }
    );

    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith({
      code: 'reasoning_only_response',
      finishReason: 'length',
    });
    fetchSpy.mockRestore();
  });

  it('test_when_streaming_tool_arguments_arrive_in_fragments_should_reassemble_one_call', async () => {
    const frames = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_3","type":"function","function":{"name":"execute_math","arguments":"{\\"expression\\":\\"pi*"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"12^2\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream({
      start(controller) {
        frames.forEach((frame) => controller.enqueue(new TextEncoder().encode(frame)));
        controller.close();
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }));

    const result = await callAI([{ role: 'user', content: 'use math' }], { stream: true });

    expect(result).toContain('[TOOL_CALL_NATIVE:');
    expect(result).toContain('execute_math');
    expect(result).toContain('pi*12^2');
    fetchSpy.mockRestore();
  });

  it('test_when_http_error_body_is_not_json_should_fallback_to_status_text_logging', async () => {
    // Given
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('upstream exploded', { status: 500 }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // When
    const result = await callAI([{ role: 'user', content: 'broken' }], { agentId: 'ai-9' });

    // Then
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('API Error:', 'HTTP 500', '(Agent: ai-9)');
    fetchSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('test_when_network_throws_without_agent_id_should_log_empty_suffix_and_return_null', async () => {
    // Given
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // When
    const result = await callAI([{ role: 'user', content: 'hello' }]);

    // Then
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('API Call Failed:', expect.any(Error), '');
    fetchSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('test_when_tool_choice_alias_and_stream_flag_are_provided_should_send_both_fields', async () => {
    // Given
    const capturedBodies = [];
    server.use(
      http.post('*/chat/completions', async ({ request }) => {
        capturedBodies.push(await request.json());
        return HttpResponse.json({
          choices: [{ message: { content: 'alias ok' } }],
        });
      })
    );

    // When
    const result = await callAI(
      [{ role: 'user', content: 'hello' }],
      { tool_choice: 'required', stream: true }
    );

    // Then
    expect(result).toBe('alias ok');
    expect(capturedBodies[0].tool_choice).toBe('required');
    expect(capturedBodies[0].stream).toBe(true);
  });
});

describe('chatService.cleanMessageContent', () => {
  it('test_when_clean_message_content_contains_control_tags_should_strip_tags_and_keep_markdown_table', () => {
    // Given
    const raw = `
[MULTI:one|two]
[SCHEDULE:10]
[REACT: 👍 ]
[SILENCE]
[1] [R2]
[TOOL_CALL: run {"x":1}]
| head | tail |
| --- | --- |
[GAME:Poll:What to eat?]
hello  world
`;

    // When
    const cleaned = cleanMessageContent(raw);

    // Then
    expect(cleaned).toContain('👍');
    expect(cleaned).toContain('| head | tail |');
    expect(cleaned).toContain('[1] [R2]');
    expect(cleaned).toContain('A poll has been created');
    expect(cleaned).not.toContain('[MULTI:');
    expect(cleaned).not.toContain('[SCHEDULE:');
    expect(cleaned).not.toContain('[TOOL_CALL:');
  });

  it('test_when_input_is_null_or_undefined_should_return_empty_string', () => {
    // Given
    const nullInput = null;
    const undefinedInput = undefined;

    // When
    const nullResult = cleanMessageContent(nullInput);
    const undefinedResult = cleanMessageContent(undefinedInput);

    // Then
    expect(nullResult).toBe('');
    expect(undefinedResult).toBe('');
  });

  it('test_when_input_contains_non_control_brackets_should_preserve_them', () => {
    // Given
    const raw = '  ] [ABC] [immersive_translate:anything] useful text  ';

    // When
    const cleaned = cleanMessageContent(raw);

    // Then
    expect(cleaned).toBe('] [ABC] [immersive_translate:anything] useful text');
  });

  it('test_when_message_contains_code_indices_and_tuple_labels_should_preserve_them', () => {
    const raw = 'const first = xs[0]; type Entry = [key: string, value: number];';

    expect(cleanMessageContent(raw)).toBe(raw);
  });
});

describe('chatService.delayHelpers', () => {
  it('test_when_typing_speed_is_unknown_and_message_length_is_extreme_should_clamp_delay', () => {
    // Given
    const tinyLength = 0;
    const hugeLength = 10_000_000;

    // When
    const tinyDelay = calculateTypingDelay(tinyLength, 'unknown-speed');
    const hugeDelay = calculateTypingDelay(hugeLength, 'unknown-speed');

    // Then
    expect(tinyDelay).toBe(500);
    expect(hugeDelay).toBe(3000);
  });

  it('test_when_random_delay_receives_equal_or_negative_ranges_should_return_stable_numeric_result', () => {
    // Given
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    // When
    const equalRange = getRandomDelay({ min: 10, max: 10 });
    const reversedRange = getRandomDelay({ min: 10, max: -10 });

    // Then
    expect(equalRange).toBe(10);
    expect(Number.isFinite(reversedRange)).toBe(true);
    randomSpy.mockRestore();
  });
});
