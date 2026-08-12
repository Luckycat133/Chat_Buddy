import { describe, expect, it } from 'vitest';
import { assertToolAuthorized, getToolAuthorization } from './toolAuthorization';

describe('tool authorization', () => {
    const persona = {
        id: 'agent-coder',
        toolsEnabled: true,
        tools: [{ name: 'analyze_code' }],
        memory: { enabled: true, longTermEnabled: true },
    };

    it('allows an explicitly enabled and declared tool', () => {
        expect(getToolAuthorization(persona, 'analyze_code')).toEqual({ allowed: true, reason: null });
    });

    it('denies tools when the persona capability switch is off', () => {
        expect(getToolAuthorization({ ...persona, toolsEnabled: false }, 'analyze_code')).toEqual({
            allowed: false,
            reason: 'tools_disabled',
        });
    });

    it('denies undeclared tools even when tools are enabled', () => {
        expect(() => assertToolAuthorized(persona, 'run_code')).toThrow(/tool_not_allowed/);
    });

    it('allows memory exchange only for long-term-memory personas', () => {
        expect(getToolAuthorization(persona, 'MEMORY_REQUEST').allowed).toBe(true);
        expect(getToolAuthorization({ ...persona, memory: { enabled: true, longTermEnabled: false } }, 'MEMORY_REQUEST')).toEqual({
            allowed: false,
            reason: 'capability_disabled',
        });
    });
});
