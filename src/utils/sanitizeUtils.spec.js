import { describe, expect, it } from 'vitest';
import {
    sanitizeHTML,
    isSafeURL,
    sanitizeURL,
    sanitizeFileName,
    stripDangerousHTML,
    sanitizeImageURL,
    sanitizeObjectStrings,
} from './sanitizeUtils';

describe('sanitizeUtils', () => {
    describe('sanitizeHTML', () => {
        it('test_when_input_contains_html_entities_should_escape_them', () => {
            expect(sanitizeHTML('<script>alert("xss")</script>')).toBe(
                '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
            );
        });

        it('test_when_input_is_not_string_should_return_empty', () => {
            expect(sanitizeHTML(null)).toBe('');
            expect(sanitizeHTML(undefined)).toBe('');
            expect(sanitizeHTML(123)).toBe('');
        });

        it('test_when_input_has_ampersand_should_escape', () => {
            expect(sanitizeHTML('a & b')).toBe('a &amp; b');
        });

        it('test_when_input_has_single_quote_should_escape', () => {
            expect(sanitizeHTML("it's")).toBe("it&#x27;s");
        });
    });

    describe('isSafeURL', () => {
        it('test_when_url_has_https_protocol_should_be_safe', () => {
            expect(isSafeURL('https://example.com')).toBe(true);
        });

        it('test_when_url_has_javascript_protocol_should_be_unsafe', () => {
            expect(isSafeURL('javascript:alert(1)')).toBe(false);
        });

        it('test_when_url_is_empty_should_be_unsafe', () => {
            expect(isSafeURL('')).toBe(false);
        });

        it('test_when_url_is_not_string_should_be_unsafe', () => {
            expect(isSafeURL(null)).toBe(false);
        });

        it('test_when_url_has_mailto_protocol_should_be_safe', () => {
            expect(isSafeURL('mailto:test@example.com')).toBe(true);
        });
    });

    describe('sanitizeURL', () => {
        it('test_when_url_has_javascript_protocol_should_return_empty', () => {
            expect(sanitizeURL('javascript:alert(1)')).toBe('');
        });

        it('test_when_url_is_valid_should_return_unchanged', () => {
            expect(sanitizeURL('https://example.com')).toBe('https://example.com');
        });

        it('test_when_url_is_not_string_should_return_empty', () => {
            expect(sanitizeURL(42)).toBe('');
        });
    });

    describe('sanitizeFileName', () => {
        it('test_when_filename_has_path_traversal_should_remove', () => {
            expect(sanitizeFileName('../../../etc/passwd')).toBe('___etc_passwd');
        });

        it('test_when_filename_has_special_chars_should_replace', () => {
            expect(sanitizeFileName('file<name>.txt')).toBe('file_name_.txt');
        });

        it('test_when_filename_is_very_long_should_truncate', () => {
            const long = 'a'.repeat(300);
            expect(sanitizeFileName(long).length).toBe(255);
        });

        it('test_when_filename_is_not_string_should_return_empty', () => {
            expect(sanitizeFileName(null)).toBe('');
        });
    });

    describe('stripDangerousHTML', () => {
        it('test_when_html_has_script_tag_should_remove', () => {
            expect(stripDangerousHTML('<script>alert(1)</script>hello')).toBe('hello');
        });

        it('test_when_html_has_iframe_should_remove', () => {
            expect(stripDangerousHTML('<iframe src="evil"></iframe>safe')).toBe('safe');
        });

        it('test_when_html_is_normal_should_preserve', () => {
            expect(stripDangerousHTML('<p>Hello</p>')).toBe('<p>Hello</p>');
        });

        it('test_when_tag_or_attribute_uses_variant_spacing_should_remove_it', () => {
            expect(stripDangerousHTML('<script >alert(1)</script><p onclick="alert(2)">safe</p>')).toBe('<p>safe</p>');
        });
    });

    describe('sanitizeImageURL', () => {
        it('allows local, web, blob, and raster data images', () => {
            expect(sanitizeImageURL('/avatars/default.png')).toBe('/avatars/default.png');
            expect(sanitizeImageURL('https://example.com/avatar.png')).toBe('https://example.com/avatar.png');
            expect(sanitizeImageURL('blob:https://example.com/id')).toBe('blob:https://example.com/id');
            expect(sanitizeImageURL('data:image/png;base64,aGVsbG8=')).toBe('data:image/png;base64,aGVsbG8=');
        });

        it('rejects executable and SVG data URLs', () => {
            expect(sanitizeImageURL('javascript:alert(1)')).toBe('');
            expect(sanitizeImageURL('data:text/html,<script>alert(1)</script>')).toBe('');
            expect(sanitizeImageURL('data:image/svg+xml,<svg onload="alert(1)"/>')).toBe('');
            expect(sanitizeImageURL('//evil.example/avatar.png')).toBe('');
        });
    });

    describe('sanitizeObjectStrings', () => {
        it('test_when_object_has_html_strings_should_sanitize', () => {
            const input = { name: '<b>test</b>', count: 5 };
            const result = sanitizeObjectStrings(input);
            expect(result.name).toBe('&lt;b&gt;test&lt;/b&gt;');
            expect(result.count).toBe(5);
        });

        it('test_when_array_has_html_strings_should_sanitize', () => {
            const input = ['<script>', 'normal'];
            const result = sanitizeObjectStrings(input);
            expect(result[0]).toBe('&lt;script&gt;');
            expect(result[1]).toBe('normal');
        });

        it('test_when_max_depth_exceeded_should_stop_recursing', () => {
            const deep = { a: { b: { c: '<x>' } } };
            const result = sanitizeObjectStrings(deep, 1);
            expect(result.a.b).toEqual({ c: '<x>' });
        });
    });
});
