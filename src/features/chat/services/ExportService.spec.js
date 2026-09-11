import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    exportAsHTML,
    exportAsJSON,
    exportAsTXT,
    exportChat,
    downloadFile,
} from './ExportService';

const CURRENT_USER = 'user-me';
const PEER_A = 'ai-alpha';
const PEER_B = 'ai-beta';

const personas = [
    { id: PEER_A, name: 'Alpha', avatar: 'https://example.com/alpha.png' },
    { id: PEER_B, name: 'Beta' }, // no avatar on purpose
];

const baseChat = (overrides = {}) => ({
    id: 'chat-1',
    name: 'Test Chat',
    createdAt: '2024-05-01T10:00:00Z',
    participants: [CURRENT_USER, PEER_A],
    messages: [
        {
            id: 'm1',
            senderId: CURRENT_USER,
            content: 'hi there',
            timestamp: '2024-05-01T10:00:00Z',
        },
        {
            id: 'm2',
            senderId: PEER_A,
            content: 'hello back',
            timestamp: '2024-05-01T10:05:00Z',
        },
    ],
    ...overrides,
});

describe('exportAsTXT', () => {
    it('includes a header with the chat name, participants and message count', () => {
        const txt = exportAsTXT(baseChat(), personas, 'Me');

        expect(txt).toContain('Chat Export: Test Chat');
        expect(txt).toContain('Total Messages: 2');
        expect(txt).toContain('Participants: Me, Alpha');
    });

    it('renders each message with the sender name and content', () => {
        const txt = exportAsTXT(baseChat(), personas, 'Me');

        expect(txt).toContain('Me:');
        expect(txt).toContain('hi there');
        expect(txt).toContain('Alpha:');
        expect(txt).toContain('hello back');
    });

    it('falls back to "Unknown" for senders missing from the persona list', () => {
        const chat = baseChat({
            messages: [
                {
                    id: 'm1',
                    senderId: 'mystery-ai',
                    content: 'who am i',
                    timestamp: '2024-05-01T10:00:00Z',
                },
            ],
        });

        const txt = exportAsTXT(chat, personas, 'Me');

        expect(txt).toContain('Unknown:');
    });

    it('uses "You" as the default current user name when none is supplied', () => {
        const txt = exportAsTXT(baseChat(), []);

        expect(txt).toContain('You:');
    });

    it('closes with the End-of-Export footer', () => {
        const txt = exportAsTXT(baseChat(), personas, 'Me');

        expect(txt).toContain('End of Export');
    });
});

describe('exportAsJSON', () => {
    it('returns a parseable JSON document with exportInfo metadata', () => {
        const json = exportAsJSON(baseChat(), personas);
        const parsed = JSON.parse(json);

        expect(parsed.exportInfo.chatName).toBe('Test Chat');
        expect(parsed.exportInfo.totalMessages).toBe(2);
        expect(parsed.exportInfo.participants).toEqual([
            { id: CURRENT_USER, name: 'You' },
            { id: PEER_A, name: 'Alpha' },
        ]);
    });

    it('embeds the chat with messages and a resolved senderName', () => {
        const parsed = JSON.parse(exportAsJSON(baseChat(), personas));

        expect(parsed.chat.id).toBe('chat-1');
        expect(parsed.chat.messages).toHaveLength(2);
        expect(parsed.chat.messages[0].senderName).toBe('You');
        expect(parsed.chat.messages[1].senderName).toBe('Alpha');
    });

    it('uses "Unknown" for senders that are not in the persona list', () => {
        const chat = baseChat({
            participants: [CURRENT_USER, 'mystery-ai'],
            messages: [
                {
                    id: 'm1',
                    senderId: 'mystery-ai',
                    content: 'who am i',
                    timestamp: '2024-05-01T10:00:00Z',
                },
            ],
        });

        const parsed = JSON.parse(exportAsJSON(chat, personas));

        expect(parsed.chat.messages[0].senderName).toBe('Unknown');
    });

    it('always labels the current user as "You" regardless of personas', () => {
        const parsed = JSON.parse(exportAsJSON(baseChat(), personas));

        const meEntry = parsed.exportInfo.participants.find((p) => p.id === CURRENT_USER);
        expect(meEntry.name).toBe('You');
    });
});

describe('exportAsHTML', () => {
    it('produces a standalone HTML document with the expected scaffolding', () => {
        const html = exportAsHTML(baseChat(), personas, 'Me');

        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html).toContain('<html lang="en">');
        expect(html).toContain('<title>Chat Export - Test Chat</title>');
        expect(html).toContain('Exported from Chat Buddy');
    });

    it('renders one message block per message and labels me vs other correctly', () => {
        const html = exportAsHTML(baseChat(), personas, 'Me');

        const meBlocks = html.match(/class="message message-me"/g) || [];
        const otherBlocks = html.match(/class="message message-other"/g) || [];

        expect(meBlocks).toHaveLength(1);
        expect(otherBlocks).toHaveLength(1);
    });

    it('escapes HTML in message content to prevent injection', () => {
        const chat = baseChat({
            messages: [
                {
                    id: 'm1',
                    senderId: CURRENT_USER,
                    content: '<script>alert("xss")</script> & "quoted"',
                    timestamp: '2024-05-01T10:00:00Z',
                },
            ],
        });

        const html = exportAsHTML(chat, personas, 'Me');

        expect(html).not.toContain('<script>alert("xss")</script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&amp;');
        expect(html).toContain('&quot;quoted&quot;');
    });

    it('escapes HTML in the chat name used in the title', () => {
        const chat = baseChat({ name: '<img src=x onerror=alert(1)>' });
        const html = exportAsHTML(chat, personas, 'Me');

        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('accepts only http(s) and data:image avatar URLs', () => {
        const evil = 'javascript:alert(1)';
        const personasWithEvil = [
            { id: PEER_A, name: 'Alpha', avatar: evil },
            { id: PEER_B, name: 'Beta', avatar: 'data:image/png;base64,AAAA' },
            { id: 'other', name: 'Other', avatar: 'https://example.com/other.png' },
        ];
        const chat = baseChat({
            participants: [CURRENT_USER, 'other'],
            messages: [
                {
                    id: 'm1',
                    senderId: PEER_A,
                    content: 'first',
                    timestamp: '2024-05-01T10:00:00Z',
                },
                {
                    id: 'm2',
                    senderId: PEER_B,
                    content: 'second',
                    timestamp: '2024-05-01T10:05:00Z',
                },
                {
                    id: 'm3',
                    senderId: 'other',
                    content: 'third',
                    timestamp: '2024-05-01T10:10:00Z',
                },
            ],
        });

        const html = exportAsHTML(chat, personasWithEvil, 'Me');

        expect(html).not.toContain('javascript:alert(1)');
        expect(html).toContain('data:image/png;base64,AAAA');
        expect(html).toContain('https://example.com/other.png');
    });

    it('renders newlines in content as <br> tags', () => {
        const chat = baseChat({
            messages: [
                {
                    id: 'm1',
                    senderId: CURRENT_USER,
                    content: 'line one\nline two',
                    timestamp: '2024-05-01T10:00:00Z',
                },
            ],
        });

        const html = exportAsHTML(chat, personas, 'Me');

        expect(html).toContain('line one<br>line two');
    });

    it('falls back to an initial-letter placeholder when an avatar is missing', () => {
        const chat = baseChat({
            participants: [CURRENT_USER, PEER_B],
            messages: [
                {
                    id: 'm1',
                    senderId: PEER_B,
                    content: 'no avatar here',
                    timestamp: '2024-05-01T10:00:00Z',
                },
            ],
        });

        const html = exportAsHTML(chat, personas, 'Me');

        expect(html).toContain('class="avatar-placeholder">B</div>');
    });
});

describe('downloadFile', () => {
    let createObjectURL;
    let revokeObjectURL;
    let appendChild;
    let removeChild;
    let click;
    let capturedLink;

    beforeEach(() => {
        capturedLink = null;
        click = vi.fn();
        appendChild = vi.fn((node) => {
            if (node?.tagName === 'A') capturedLink = node;
            return node;
        });
        removeChild = vi.fn();
        createObjectURL = vi.fn(() => 'blob:mock-url');
        revokeObjectURL = vi.fn();

        global.URL.createObjectURL = createObjectURL;
        global.URL.revokeObjectURL = revokeObjectURL;

        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') {
                el.click = click;
            }
            return el;
        });
        vi.spyOn(document.body, 'appendChild').mockImplementation(appendChild);
        vi.spyOn(document.body, 'removeChild').mockImplementation(removeChild);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('builds a Blob with the given content and mime type', () => {
        downloadFile('hello world', 'note.txt', 'text/plain');

        const blob = createObjectURL.mock.calls[0]?.[0];
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('text/plain');
    });

    it('triggers a click on an anchor whose download attribute matches the filename', () => {
        downloadFile('payload', 'log.txt', 'text/plain');

        expect(appendChild).toHaveBeenCalled();
        expect(capturedLink?.download).toBe('log.txt');
        expect(click).toHaveBeenCalledTimes(1);
    });

    it('revokes the object URL after clicking', () => {
        downloadFile('payload', 'log.txt', 'text/plain');

        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        expect(removeChild).toHaveBeenCalledWith(capturedLink);
    });
});

describe('exportChat', () => {
    let click;

    beforeEach(() => {
        click = vi.fn();
        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') el.click = click;
            return el;
        });
        vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
        vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('downloads a TXT file when format is txt', () => {
        exportChat(baseChat(), personas, 'txt', 'Me');

        expect(click).toHaveBeenCalledTimes(1);
    });

    it('downloads a JSON file when format is json', () => {
        exportChat(baseChat(), personas, 'json');

        expect(click).toHaveBeenCalledTimes(1);
    });

    it('downloads an HTML file when format is html', () => {
        exportChat(baseChat(), personas, 'html');

        expect(click).toHaveBeenCalledTimes(1);
    });

    it('sanitises the chat name into the filename', () => {
        const originalCreateElement = Document.prototype.createElement;
        let anchorName = null;
        vi.spyOn(document, 'createElement').mockImplementation(function spyCreate(tag) {
            const el = originalCreateElement.call(this, tag);
            if (tag === 'a') {
                el.click = vi.fn();
                Object.defineProperty(el, 'download', {
                    set(value) {
                        anchorName = value;
                    },
                    get() {
                        return anchorName;
                    },
                });
            }
            return el;
        });

        exportChat(baseChat({ name: 'Hello / World *!' }), personas, 'txt');

        // non-word chars are replaced with `_`; today is appended
        expect(anchorName).toMatch(/^Hello___World____\d{4}-\d{2}-\d{2}\.txt$/);
    });

    it('throws when the requested format is not supported', () => {
        expect(() => exportChat(baseChat(), personas, 'pdf')).toThrow(/Unsupported export format/);
    });
});