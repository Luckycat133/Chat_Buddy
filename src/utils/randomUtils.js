const UINT32_RANGE = 0x1_0000_0000;

export function secureRandomInt(maxExclusive, cryptoProvider = globalThis.crypto) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
        throw new RangeError('maxExclusive must be a positive 32-bit integer');
    }
    if (!cryptoProvider?.getRandomValues) {
        throw new Error('Web Crypto is required for secure random values');
    }

    const upperBound = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    const values = new Uint32Array(1);
    do {
        cryptoProvider.getRandomValues(values);
    } while (values[0] >= upperBound);

    return values[0] % maxExclusive;
}
