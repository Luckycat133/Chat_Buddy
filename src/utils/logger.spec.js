import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createLogger, setLogLevel, addLogListener, AppError, wrapAsync, safeExec, safeExecAsync } from './logger';

describe('logger', () => {
    beforeEach(() => {
        setLogLevel('debug');
    });

    describe('createLogger', () => {
        it('test_when_debug_level_set_should_emit_debug_messages', () => {
            const log = createLogger('test');
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            log.debug('hello', { key: 'value' });
            expect(spy).toHaveBeenCalled();
            const call = spy.mock.calls[0];
            expect(call[0]).toContain('[DEBUG][test]');
            expect(call[1]).toBe('hello');
            spy.mockRestore();
        });

        it('test_when_warn_level_set_should_suppress_debug_messages', () => {
            setLogLevel('warn');
            const log = createLogger('test');
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            log.debug('should not appear');
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        it('test_when_error_logged_should_use_console_error', () => {
            const log = createLogger('test');
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            log.error('something broke', { code: 'ERR' });
            expect(spy).toHaveBeenCalled();
            expect(spy.mock.calls[0][0]).toContain('[ERROR][test]');
            spy.mockRestore();
        });
    });

    describe('addLogListener', () => {
        it('test_when_listener_added_should_receive_log_entries', () => {
            const listener = vi.fn();
            const remove = addLogListener(listener);
            const log = createLogger('listener-test');
            log.info('test message');
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener.mock.calls[0][0].level).toBe('info');
            expect(listener.mock.calls[0][0].context).toBe('listener-test');
            expect(listener.mock.calls[0][0].message).toBe('test message');
            remove();
        });

        it('test_when_listener_removed_should_not_receive_entries', () => {
            const listener = vi.fn();
            const remove = addLogListener(listener);
            remove();
            const log = createLogger('removed-test');
            log.info('after remove');
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('AppError', () => {
        it('test_when_app_error_created_should_have_code_and_context', () => {
            const err = new AppError('AUTH_FAILED', 'Authentication failed', {
                cause: new Error('token expired'),
                context: { userId: 'u1' },
                recoverable: true,
            });
            expect(err.code).toBe('AUTH_FAILED');
            expect(err.message).toBe('Authentication failed');
            expect(err.context).toEqual({ userId: 'u1' });
            expect(err.recoverable).toBe(true);
            expect(err.cause).toBeInstanceOf(Error);
        });

        it('test_when_app_error_serialized_should_produce_clean_json', () => {
            const err = new AppError('TIMEOUT', 'Request timed out', { recoverable: true });
            const json = err.toJSON();
            expect(json.code).toBe('TIMEOUT');
            expect(json.recoverable).toBe(true);
            expect(json.name).toBe('AppError');
        });
    });

    describe('wrapAsync', () => {
        it('test_when_async_fn_succeeds_should_return_result', async () => {
            const fn = vi.fn().mockResolvedValue(42);
            const wrapped = wrapAsync(fn, { context: 'test' });
            const result = await wrapped();
            expect(result).toBe(42);
        });

        it('test_when_async_fn_throws_should_return_fallback', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('boom'));
            const wrapped = wrapAsync(fn, { context: 'test', fallback: null });
            const result = await wrapped();
            expect(result).toBeNull();
        });

        it('test_when_async_fn_throws_app_error_should_log_with_details', async () => {
            const fn = vi.fn().mockRejectedValue(new AppError('CUSTOM', 'custom error'));
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const wrapped = wrapAsync(fn, { context: 'test' });
            await wrapped();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('safeExec', () => {
        it('test_when_fn_succeeds_should_return_result', () => {
            const result = safeExec(() => 1 + 1);
            expect(result).toBe(2);
        });

        it('test_when_fn_throws_should_return_fallback', () => {
            const result = safeExec(() => { throw new Error('oops'); }, { fallback: -1 });
            expect(result).toBe(-1);
        });
    });

    describe('safeExecAsync', () => {
        it('test_when_async_fn_succeeds_should_return_result', async () => {
            const wrapped = safeExecAsync(async () => 'ok');
            const result = await wrapped();
            expect(result).toBe('ok');
        });

        it('test_when_async_fn_throws_should_return_fallback', async () => {
            const wrapped = safeExecAsync(async () => { throw new Error('fail'); }, { fallback: 'fallback' });
            const result = await wrapped();
            expect(result).toBe('fallback');
        });
    });
});
