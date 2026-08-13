import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatComposer from './ChatComposer';

vi.mock('../../context/ChatContext', () => ({
  useChat: () => ({ personas: [{ id: 'ai-1', name: 'Luna', name_zh: '露娜' }] }),
}));

vi.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'zh',
    t: (key) => ({ type_message: '输入消息...', send: '发送', more: '更多' }[key] || key),
  }),
}));

vi.mock('../../../../components/EmojiPicker', () => ({ default: () => null }));
vi.mock('../../../../components/StickerPicker', () => ({ default: () => null }));
vi.mock('../../../../components/FileUploader', () => ({ default: () => null }));

const chat = {
  id: 'chat-1',
  name: 'Luna',
  participants: ['user-me', 'ai-1'],
};

describe('ChatComposer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('test_when_a_draft_is_sent_should_not_restore_the_sent_text_on_the_next_frame', async () => {
    const onSendMessage = vi.fn(() => ({ success: true }));
    render(
      <ChatComposer
        chat={chat}
        onSendMessage={onSendMessage}
        onSendFile={vi.fn()}
        onSendSticker={vi.fn()}
      />
    );
    const input = screen.getByRole('textbox', { name: '输入消息...' });

    fireEvent.change(input, { target: { value: '刚刚写好的消息' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: false });
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
    });

    expect(onSendMessage).toHaveBeenCalledWith('刚刚写好的消息', null);
    expect(input).toHaveValue('');
  });
});
