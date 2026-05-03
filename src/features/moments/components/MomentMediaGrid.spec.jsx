import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../../context/LanguageContext';
import MomentMediaGrid from './MomentMediaGrid';

describe('MomentMediaGrid', () => {
    it('shows a text fallback when the image fails to load after retries', async () => {
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

        const getImage = () => document.querySelector('img');
        expect(getImage()).not.toBeNull();

        for (let i = 0; i < 3; i++) {
            const img = getImage();
            if (img) fireEvent.error(img);
        }

        await waitFor(() => {
            expect(screen.getAllByText('海边').length).toBeGreaterThan(0);
        });
    });
});
