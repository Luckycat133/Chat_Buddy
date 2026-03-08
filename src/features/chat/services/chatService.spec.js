import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../test/msw/server';

const mockConfig = {
  apiKey: 'test-api-key',
  model: 'mock-model',
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

  it('test_when_max_tokens_and_custom_model_are_provided_should_send_them_in_request', async () => {
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
    expect(capturedBodies[0].model).toBe('custom-model');
    expect(capturedBodies[0].max_tokens).toBe(2048);
    expect(capturedBodies[0].temperature).toBe(0.1);
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

  it('test_when_input_contains_orphan_brackets_and_mixed_tags_should_still_return_trimmed_text', () => {
    // Given
    const raw = '  ] [ABC] [immersive_translate:anything] useful text  ';

    // When
    const cleaned = cleanMessageContent(raw);

    // Then
    expect(cleaned).toBe('useful text');
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
