import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../../context/LanguageContext';
import MomentMediaGrid from './MomentMediaGrid';

describe('MomentMediaGrid', () => {
    it('shows a text fallback when the image fails to load', () => {
        render(
            <LanguageProvider>
                <MomentMediaGrid
                    post={{
                        content: '刚在海边拍到一张很好看的晚霞。',
                        location: '海边',
                        images: ['https://example.com/broken-image.jpg'],
                    }}
                />
            </LanguageProvider>
        );

        const image = document.querySelector('img');
        expect(image).not.toBeNull();
        fireEvent.error(image);

        expect(screen.getAllByText('海边').length).toBeGreaterThan(0);
        expect(screen.getByText(/text cover|文字封面/i)).toBeInTheDocument();
    });
});
