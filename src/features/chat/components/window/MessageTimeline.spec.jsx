import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MessageTimeline from './MessageTimeline';

vi.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    language: 'en',
  }),
}));

vi.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ bubbleStyle: 'default' }),
}));

vi.mock('../QuotedMessage', () => ({
  default: ({ senderName }) => <div data-testid="quoted-message">{senderName}</div>,
}));

vi.mock('../PollMessage', () => ({
  default: ({ poll }) => <div data-testid="poll-message">{poll.question}</div>,
}));

vi.mock('../FileMessage', () => ({
  GeneratedFileMessage: ({ fileData }) => <div data-testid="generated-file">{fileData.filename}</div>,
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
  default: ({ url }) => <div data-testid="image-message">{url}</div>,
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
});
