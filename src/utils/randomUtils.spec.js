import { describe, expect, it } from 'vitest';
import { secureRandomInt } from './randomUtils';

describe('secureRandomInt', () => {
    it('returns an unbiased value within the requested range', () => {
        const samples = [0xffff_ffff, 42];
        const cryptoProvider = {
            getRandomValues(values) {
                values[0] = samples.shift();
                return values;
            },
        };

        expect(secureRandomInt(100, cryptoProvider)).toBe(42);
        expect(samples).toHaveLength(0);
    });

    it('rejects invalid ranges and unavailable Web Crypto', () => {
        expect(() => secureRandomInt(0, {})).toThrow(RangeError);
        expect(() => secureRandomInt(100, {})).toThrow('Web Crypto');
    });
});
