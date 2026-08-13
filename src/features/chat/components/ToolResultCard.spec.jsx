import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ToolResultCard from './ToolResultCard';

describe('ToolResultCard', () => {
    it('shows an accessible completed state, duration, and expandable result', () => {
        render(
            <ToolResultCard
                language="en"
                msg={{
                    toolName: 'execute_math',
                    status: 'success',
                    inputSummary: 'Computing: 1200 / 7',
                    outputDetail: 'Result: 171.428571',
                    durationMs: 1234,
                }}
            />
        );

        expect(screen.getByRole('status', { name: 'Math: Completed, 1.2s' })).toBeInTheDocument();
        expect(screen.getByText('Completed · 1.2s')).toBeInTheDocument();

        const detailsButton = screen.getByRole('button', { name: 'Math: Completed. Expand details' });
        fireEvent.click(detailsButton);
        expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Result: 171.428571')).toBeInTheDocument();
    });

    it('describes image generation honestly while it is running', () => {
        render(
            <ToolResultCard
                language="zh"
                msg={{ toolName: 'generate_image', status: 'loading', inputSummary: '橘猫插画' }}
            />
        );

        expect(screen.getByRole('status')).toHaveTextContent('正在生成图片');
        expect(screen.queryByText('正在相册中挑选照片')).not.toBeInTheDocument();
    });

    it('announces a failed tool as an alert', () => {
        render(
            <ToolResultCard
                language="zh"
                msg={{
                    toolName: 'sonar_search',
                    status: 'error',
                    inputSummary: '搜索当前资料',
                    outputDetail: '网络不可用',
                    durationMs: 80,
                }}
            />
        );

        expect(screen.getByRole('alert', { name: '实时搜索: 失败, 80ms' })).toBeInTheDocument();
    });
});
