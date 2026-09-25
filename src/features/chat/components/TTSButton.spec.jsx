import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TTSButton from './TTSButton';

const mocks = vi.hoisted(() => ({
  cloudEnabled: vi.fn(() => true),
  getCloud: vi.fn(),
  synthesizeSpeech: vi.fn(),
  playAudio: vi.fn(),
  stopAudio: vi.fn(),
  isMiniMaxConfigured: vi.fn(() => false),
}));

vi.mock('../../../api/cloud-adapter', () => ({
  cloudEnabled: mocks.cloudEnabled,
  getCloud: mocks.getCloud,
}));

vi.mock('../../../services/minimaxService', () => ({
  synthesizeSpeech: mocks.synthesizeSpeech,
  playAudio: mocks.playAudio,
  stopAudio: mocks.stopAudio,
  isMiniMaxConfigured: mocks.isMiniMaxConfigured,
}));

function audioElement() {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    onended: null,
    onerror: null,
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset?.());
  mocks.cloudEnabled.mockReturnValue(true);
  mocks.isMiniMaxConfigured.mockReturnValue(false);
  mocks.playAudio.mockImplementation(() => audioElement());
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:cloud-tts'),
    revokeObjectURL: vi.fn(),
  });
});

describe('TTSButton cloud capability', () => {
  it('synthesizes through the cloud client even when no Vite provider key exists', async () => {
    mocks.getCloud.mockReturnValue({
      synthesizeSpeech: vi.fn().mockResolvedValue({
        audioBase64: 'QUJD',
        format: 'mp3',
        model: 'speech-2.8-hd',
        durationMs: 1200,
      }),
    });

    render(<TTSButton text="你好" personaId="actor-1" />);
    fireEvent.click(screen.getByRole('button', { name: '朗读' }));

    await waitFor(() => expect(mocks.playAudio).toHaveBeenCalledWith('blob:cloud-tts'));
    expect(mocks.getCloud().synthesizeSpeech).toHaveBeenCalledWith({ text: '你好' });
    expect(mocks.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it('surfaces a server capability error instead of fabricating playback', async () => {
    mocks.getCloud.mockReturnValue({
      synthesizeSpeech: vi.fn().mockRejectedValue(new Error('media tts is not configured')),
    });

    render(<TTSButton text="未配置时的消息" personaId="actor-2" />);
    fireEvent.click(screen.getByRole('button', { name: '朗读' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('media tts is not configured');
    expect(mocks.playAudio).not.toHaveBeenCalled();
  });

  it('keeps the legacy provider hidden when cloud mode is off and no key exists', () => {
    mocks.cloudEnabled.mockReturnValue(false);
    const { container } = render(<TTSButton text="你好" personaId="ai-1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
