import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MessageTimeline from './MessageTimeline';

const helpers = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  language: 'en',
}));

vi.mock('../../../../utils/fileUtils', () => ({
  downloadFile: helpers.downloadFile,
}));

vi.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    language: helpers.language,
  }),
}));

vi.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ bubbleStyle: 'default' }),
}));

vi.mock('../QuotedMessage', () => ({
  default: ({ senderName }) => <div data-testid="quoted-message">{senderName}</div>,
}));

vi.mock('../PollMessage', () => ({
  default: ({ poll, onVote }) => (
    <button data-testid="poll-message" type="button" onClick={() => onVote(poll.id, poll.options[0].id, 'switch')}>
      {poll.question}
    </button>
  ),
}));

vi.mock('../FileMessage', () => ({
  GeneratedFileMessage: ({ fileData, onDownload }) => (
    <button data-testid="generated-file" type="button" onClick={onDownload}>{fileData.filename}</button>
  ),
}));

vi.mock('../VoicePlayer', () => ({
  default: ({ duration }) => <div data-testid="voice-player">{duration}</div>,
}));

vi.mock('../CharacterTheme', () => ({
  getCharacterGlowClass: () => '',
  getCharacterThemeStyle: () => ({}),
}));

vi.mock('./TypingBubble', () => ({
  default: ({ persona }) => <div data-testid={`typing-${persona.id}`}>{persona.name}</div>,
}));

vi.mock('../ImageMessage', () => ({
  default: ({ url, onClick }) => <button data-testid="image-message" type="button" onClick={onClick}>{url}</button>,
  ImageLightbox: ({ isOpen }) => <div data-testid="image-lightbox">{String(isOpen)}</div>,
}));

vi.mock('../LinkPreview', () => ({
  default: ({ url }) => <div data-testid="link-preview">{url}</div>,
}));

vi.mock('../MarkdownCodeBlock', () => ({
  default: ({ children }) => <pre data-testid="markdown-code">{children}</pre>,
}));

vi.mock('../MermaidRenderer', () => ({
  default: ({ content }) => <div data-testid="mermaid-renderer">{content}</div>,
}));

vi.mock('../ToolResultCard', () => ({
  default: ({ msg }) => <div data-testid="tool-result-card">{msg.toolName}</div>,
}));

const currentUser = { id: 'user-me', name: 'You' };
const personas = [{ id: 'ai-1', name: 'Luna', avatar: null }];

function renderTimeline(chat, overrides = {}) {
  return render(
    <MessageTimeline
      chat={chat}
      currentUser={currentUser}
      personas={personas}
      typingIndicators={{}}
      onContextMenu={vi.fn()}
      onVotePoll={vi.fn()}
      onMentionClick={vi.fn()}
      {...overrides}
    />
  );
}

beforeEach(() => {
  helpers.language = 'en';
  helpers.downloadFile.mockClear();
});

describe('MessageTimeline', () => {
  it('test_when_message_type_is_file_should_render_file_bubble', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'user-me', content: '[FILE] report.pdf', timestamp: '2026-02-23T00:00:00.000Z' }],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('test_when_message_type_is_poll_missing_should_render_poll_not_found_text', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'ai-1', content: '[POLL:missing]', timestamp: '2026-02-23T00:00:00.000Z' }],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByText('[Poll not found]')).toBeInTheDocument();
  });

  it('test_when_message_contains_mention_should_render_clickable_mention_chip', () => {
    // Given
    const onMentionClick = vi.fn();
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'user-me', content: 'Hi @Luna', timestamp: '2026-02-23T00:00:00.000Z' }],
    };

    // When
    renderTimeline(chat, { onMentionClick });
    fireEvent.click(screen.getByText('@Luna'));

    // Then
    expect(onMentionClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'ai-1', name: 'Luna' }));
  });

  it('test_when_external_link_hovered_should_show_link_preview', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        {
          id: 'm1',
          senderId: 'user-me',
          content: '[Open docs](http://example.com)',
          timestamp: '2026-02-23T00:00:00.000Z',
        },
      ],
    };

    // When
    renderTimeline(chat);
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Open docs' }));

    // Then
    expect(screen.getByTestId('link-preview')).toHaveTextContent('http://example.com');
  });

  it('test_when_voice_and_image_messages_should_render_specialized_components', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        { id: 'm1', senderId: 'ai-1', content: '[IMG:https://cdn.example/image.png]', timestamp: '2026-02-23T00:00:00.000Z' },
        { id: 'm2', senderId: 'ai-1', content: '[VOICE:3s]', timestamp: '2026-02-23T00:01:00.000Z' },
      ],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByTestId('image-message')).toBeInTheDocument();
    expect(screen.getByTestId('voice-player')).toHaveTextContent('3s');
  });

  it('test_when_typing_indicators_include_unknown_persona_should_skip_unknown_indicator', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'user-me', content: 'hello', timestamp: '2026-02-23T00:00:00.000Z' }],
    };

    // When
    renderTimeline(chat, { typingIndicators: { 'chat-1': ['ai-unknown', 'ai-1'] } });

    // Then
    expect(screen.getByTestId('typing-ai-1')).toBeInTheDocument();
    expect(screen.queryByTestId('typing-ai-unknown')).not.toBeInTheDocument();
  });

  it('test_when_editing_indicator_is_present_should_render_editing_bubble', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'user-me', content: 'hello', timestamp: '2026-02-23T00:00:00.000Z' }],
    };

    // When
    renderTimeline(chat, { editingIndicators: { 'chat-1': ['ai-1'] } });

    // Then
    expect(screen.getByTestId('typing-ai-1')).toBeInTheDocument();
  });

  it('test_when_link_is_not_http_should_not_show_link_preview_component', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        {
          id: 'm1',
          senderId: 'user-me',
          content: '[Local link](/docs)',
          timestamp: '2026-02-23T00:00:00.000Z',
        },
      ],
    };

    // When
    renderTimeline(chat);
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Local link' }));

    // Then
    expect(screen.queryByTestId('link-preview')).not.toBeInTheDocument();
  });

  it('test_when_language_is_zh_should_render_localized_labels_and_multiple_read_receipts', () => {
    // Given
    helpers.language = 'zh';
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        { id: 'm1', senderId: 'ai-1', content: '[GIFT:🎁:礼物:Gift]', timestamp: '2026-02-23T00:00:00.000Z' },
        { id: 'm2', senderId: 'ai-1', content: '[RED_PACKET:88:好运常来]', timestamp: '2026-02-23T00:01:00.000Z' },
        { id: 'm3', senderId: 'user-me', content: 'done', timestamp: '2026-02-23T00:02:00.000Z', readBy: ['ai-1', 'ai-2'] },
      ],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByText('礼物')).toBeInTheDocument();
    expect(screen.getByText('赠送礼物')).toBeInTheDocument();
    expect(screen.getByText('好运常来')).toBeInTheDocument();
    expect(screen.getByText('查看红包')).toBeInTheDocument();
    expect(screen.getByTitle('read_by_multiple:{"count":2}')).toBeInTheDocument();
  });

  it('test_when_message_has_read_receipts_and_generated_files_should_render_both_artifacts', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        {
          id: 'm1',
          senderId: 'user-me',
          content: 'done',
          timestamp: '2026-02-23T00:00:00.000Z',
          readBy: ['ai-1'],
          generatedFiles: [{ filename: 'summary.txt', content: 'hello' }],
        },
      ],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByTitle('read_by_one')).toBeInTheDocument();
    expect(screen.getByTestId('generated-file')).toHaveTextContent('summary.txt');
  });

  it('test_when_generated_file_download_is_clicked_should_invoke_download_helper', () => {
    // Given
    helpers.downloadFile.mockClear();
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        {
          id: 'm1',
          senderId: 'user-me',
          content: 'done',
          timestamp: '2026-02-23T00:00:00.000Z',
          generatedFiles: [{ filename: 'summary.txt', content: 'hello' }],
        },
      ],
    };

    // When
    renderTimeline(chat);
    fireEvent.click(screen.getByTestId('generated-file'));

    // Then
    expect(helpers.downloadFile).toHaveBeenCalledWith('summary.txt', 'hello');
  });

  it('test_when_mention_pattern_contains_special_regex_characters_should_still_be_clickable', () => {
    // Given
    const onMentionClick = vi.fn();
    const specialPersonas = [{ id: 'ai-1', name: 'A+B', avatar: null }];
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'user-me', content: 'ping @A+B', timestamp: '2026-02-23T00:00:00.000Z' }],
    };

    // When
    render(
      <MessageTimeline
        chat={chat}
        currentUser={currentUser}
        personas={specialPersonas}
        typingIndicators={undefined}
        onContextMenu={vi.fn()}
        onVotePoll={vi.fn()}
        onMentionClick={onMentionClick}
      />
    );
    fireEvent.click(screen.getByText('@A+B'));

    // Then
    expect(onMentionClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'A+B' }));
  });

  it('test_when_recalled_message_is_rendered_should_not_throw_reference_error', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'ai-1', content: 'removed', recalled: true, timestamp: '2026-02-23T00:00:00.000Z' }],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByText(/message_recalled|recalled a message/)).toBeInTheDocument();
  });

  it('test_when_focus_message_id_provided_should_scroll_target_into_view', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'user-me', content: 'focus me', timestamp: '2026-02-23T00:00:00.000Z' }],
    };
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
    const onFocusHandled = vi.fn();

    // When
    renderTimeline(chat, { focusMessageId: 'm1', onFocusHandled });

    // Then
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(onFocusHandled).toHaveBeenCalledWith('m1');

    // Cleanup
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('test_when_message_types_include_poll_game_and_sticker_should_render_specialized_views', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [{ id: 'poll-1', question: 'Pick one', options: [{ id: 'a', text: 'Alpha' }] }],
      messages: [
        { id: 'm1', senderId: 'ai-1', content: '[POLL:poll-1]', timestamp: '2026-02-23T00:00:00.000Z' },
        { id: 'm2', senderId: 'ai-1', content: '[GAME:Trivia]', timestamp: '2026-02-23T00:01:00.000Z' },
        { id: 'm3', senderId: 'ai-1', content: '[STICKER:😀]', timestamp: '2026-02-23T00:02:00.000Z' },
      ],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByTestId('poll-message')).toHaveTextContent('Pick one');
    expect(screen.getByText('Trivia')).toBeInTheDocument();
    expect(screen.getByText('😀')).toBeInTheDocument();
  });

  it('test_when_poll_vote_is_triggered_should_forward_vote_arguments', () => {
    // Given
    const onVotePoll = vi.fn();
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [{ id: 'poll-1', question: 'Pick one', options: [{ id: 'a', text: 'Alpha' }] }],
      messages: [{ id: 'm1', senderId: 'ai-1', content: '[POLL:poll-1]', timestamp: '2026-02-23T00:00:00.000Z' }],
    };

    // When
    renderTimeline(chat, { onVotePoll });
    fireEvent.click(screen.getByTestId('poll-message'));

    // Then
    expect(onVotePoll).toHaveBeenCalledWith('poll-1', 'a', 'switch');
  });

  it('test_when_message_types_include_gift_and_red_packet_should_render_metadata_text', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        { id: 'm1', senderId: 'ai-1', content: '[GIFT:🎁:礼物:Gift]', timestamp: '2026-02-23T00:00:00.000Z' },
        { id: 'm2', senderId: 'ai-1', content: '[RED_PACKET:88:Best wishes]', timestamp: '2026-02-23T00:01:00.000Z' },
      ],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByText('Gift')).toBeInTheDocument();
    expect(screen.getByText('Best wishes')).toBeInTheDocument();
    expect(screen.getByText('Open Packet')).toBeInTheDocument();
  });

  it('test_when_message_is_tool_event_should_render_tool_result_card', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        { id: 'tool-1', senderId: 'ai-1', type: 'tool_event', toolName: 'execute_math', timestamp: '2026-02-23T00:00:00.000Z' },
      ],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByTestId('tool-result-card')).toHaveTextContent('execute_math');
  });

  it('test_when_message_has_quote_and_reaction_should_render_both_artifacts', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        { id: 'm0', senderId: 'ai-1', content: 'original', timestamp: '2026-02-23T00:00:00.000Z' },
        { id: 'm1', senderId: 'user-me', content: 'reply [REACT:😀]', quotedMessageId: 'm0', timestamp: '2026-02-23T00:01:00.000Z' },
      ],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByTestId('quoted-message')).toHaveTextContent('Luna');
    expect(screen.getByText('😀')).toBeInTheDocument();
  });

  it('test_when_mentions_target_current_user_should_use_you_title', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'ai-1', content: 'Hi @You', timestamp: '2026-02-23T00:00:00.000Z' }],
    };

    // When
    renderTimeline(chat, { personas: [] });

    // Then
    expect(screen.getByRole('button', { name: '@You' })).toHaveAttribute('title', 'mention_you');
  });

  it('test_when_markdown_contains_code_and_mermaid_should_render_lazy_blocks', async () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        { id: 'm1', senderId: 'ai-1', content: '```js\nconsole.log("hi")\n```', timestamp: '2026-02-23T00:00:00.000Z' },
        { id: 'm2', senderId: 'ai-1', content: '```mermaid\ngraph TD;A-->B;\n```', timestamp: '2026-02-23T00:01:00.000Z' },
      ],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(await screen.findByTestId('markdown-code')).toBeInTheDocument();
    expect(await screen.findByTestId('mermaid-renderer')).toHaveTextContent('graph TD;A-->B;');
  });

  it('test_when_markdown_contains_inline_code_and_table_should_render_inline_and_table_nodes', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        {
          id: 'm1',
          senderId: 'ai-1',
          content: 'Use `npm test`\n\n| Name | Value |\n| --- | --- |\n| A | 1 |',
          timestamp: '2026-02-23T00:00:00.000Z',
        },
      ],
    };

    // When
    renderTimeline(chat);

    // Then
    expect(screen.getByText('npm test')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('test_when_focus_message_target_is_missing_should_schedule_and_cancel_animation_frame', () => {
    // Given
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [{ id: 'm1', senderId: 'user-me', content: 'focus me', timestamp: '2026-02-23T00:00:00.000Z' }],
    };
    const requestSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 123);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    // When
    const view = renderTimeline(chat, { focusMessageId: 'missing' });
    view.unmount();

    // Then
    expect(requestSpy).toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalledWith(123);
    requestSpy.mockRestore();
    cancelSpy.mockRestore();
  });

  it('test_when_image_and_context_actions_are_triggered_should_open_lightbox_and_forward_context_menu', () => {
    // Given
    const onContextMenu = vi.fn();
    const chat = {
      id: 'chat-1',
      participants: ['user-me', 'ai-1'],
      polls: [],
      messages: [
        { id: 'm1', senderId: 'ai-1', content: '[IMG:https://cdn.example/image.png]', timestamp: '2026-02-23T00:00:00.000Z' },
      ],
    };

    // When
    renderTimeline(chat, { onContextMenu });
    fireEvent.click(screen.getByTestId('image-message'));
    fireEvent.contextMenu(screen.getByText('https://cdn.example/image.png'));
    fireEvent.click(screen.getByRole('button', { name: '' }));

    // Then
    expect(screen.getByTestId('image-lightbox')).toHaveTextContent('true');
    expect(onContextMenu).toHaveBeenCalledTimes(2);
  });
});
