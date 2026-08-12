import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MermaidRenderer from './MermaidRenderer';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  parseAsync: vi.fn(),
  render: vi.fn(),
}));

vi.mock('mermaid', () => ({ default: mermaidMock }));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

describe('MermaidRenderer', () => {
  beforeEach(() => {
    mermaidMock.initialize.mockReset();
    mermaidMock.parseAsync.mockReset().mockResolvedValue(true);
    mermaidMock.render.mockReset().mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><foreignObject>unsafe</foreignObject><text>safe</text></svg>',
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('sanitizes Mermaid output and uses strict rendering settings', async () => {
    const { container } = render(<MermaidRenderer content="graph TD; A-->B" />);

    await waitFor(() => expect(container.querySelector('svg')).toBeInTheDocument());

    expect(mermaidMock.initialize).toHaveBeenCalledWith(expect.objectContaining({
      securityLevel: 'strict',
      suppressErrorRendering: true,
      flowchart: { htmlLabels: false },
    }));
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container.querySelector('foreignObject')).not.toBeInTheDocument();
    expect(container.querySelector('text')).toHaveTextContent('safe');
  });

  it('rejects oversized diagrams before invoking the parser', async () => {
    render(<MermaidRenderer content={'A'.repeat(20_001)} />);

    expect(await screen.findByText('Diagram is too large to render safely')).toBeInTheDocument();
    expect(mermaidMock.parseAsync).not.toHaveBeenCalled();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });
});
