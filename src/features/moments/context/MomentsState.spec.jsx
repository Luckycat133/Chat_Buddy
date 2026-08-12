import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MomentsStateProvider, useMomentsState } from './MomentsState';

function StateProbe() {
    const { imageApiKey, setImageApiKey } = useMomentsState();
    return (
        <>
            <output aria-label="image API key state">{imageApiKey || 'empty'}</output>
            <button type="button" onClick={() => setImageApiKey('session-secret')}>Set key</button>
        </>
    );
}

describe('MomentsStateProvider', () => {
    beforeEach(() => localStorage.clear());

    it('removes legacy persisted image keys and keeps new keys in memory only', async () => {
        localStorage.setItem('chat-buddy-moments', JSON.stringify({
            posts: [],
            imageApiKey: 'legacy-secret',
            imageApiUrl: 'https://example.com/images',
        }));

        render(
            <MomentsStateProvider>
                <StateProbe />
            </MomentsStateProvider>
        );

        expect(screen.getByLabelText('image API key state')).toHaveTextContent('empty');
        await waitFor(() => {
            expect(JSON.parse(localStorage.getItem('chat-buddy-moments'))).not.toHaveProperty('imageApiKey');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Set key' }));
        expect(screen.getByLabelText('image API key state')).toHaveTextContent('session-secret');
        expect(JSON.parse(localStorage.getItem('chat-buddy-moments'))).not.toHaveProperty('imageApiKey');
    });
});
