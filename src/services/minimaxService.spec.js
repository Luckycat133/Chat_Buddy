import { describe, expect, it } from 'vitest';
import { extractGeneratedImageSource } from './minimaxService';

describe('minimaxService.extractGeneratedImageSource', () => {
    it('converts a MiniMax base64 image response into a JPEG data URL', () => {
        const result = extractGeneratedImageSource({
            data: { image_base64: ['aGVsbG8='] },
        });

        expect(result).toBe('data:image/jpeg;base64,aGVsbG8=');
    });

    it('preserves an API-provided image data URL', () => {
        const source = 'data:image/png;base64,aGVsbG8=';

        expect(extractGeneratedImageSource({ data: { image_base64: [source] } })).toBe(source);
    });

    it('supports a legacy URL response as a compatibility fallback', () => {
        const source = 'https://images.example/generated.jpg';

        expect(extractGeneratedImageSource({ data: { image_urls: [source] } })).toBe(source);
    });

    it('returns null when the response contains no usable image', () => {
        expect(extractGeneratedImageSource({ data: {} })).toBeNull();
    });
});
