/**
 * Chat History Export Service
 * T07: Chat History Export feature
 *
 * Supports TXT, JSON, and HTML export formats
 */

/**
 * Export chat history as TXT format
 * @param {Object} chat - Chat object with messages
 * @param {Array} personas - List of personas for name resolution
 * @param {string} currentUserName - Current user's name
 * @returns {string} TXT content
 */
export function exportAsTXT(chat, personas, currentUserName = 'You') {
    const getSenderName = (senderId) => {
        if (senderId === 'user-me') return currentUserName;
        const persona = personas.find(p => p.id === senderId);
        return persona?.name || 'Unknown';
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN');
    };

    let content = `========================================\n`;
    content += `Chat Export: ${chat.name}\n`;
    content += `Export Date: ${new Date().toLocaleString()}\n`;
    content += `Participants: ${chat.participants.map(getSenderName).join(', ')}\n`;
    content += `Total Messages: ${chat.messages.length}\n`;
    content += `========================================\n\n`;

    chat.messages.forEach(msg => {
        const sender = getSenderName(msg.senderId);
        const time = formatDate(msg.timestamp);
        content += `[${time}] ${sender}:\n${msg.content}\n\n`;
    });

    content += `========================================\n`;
    content += `End of Export\n`;
    content += `========================================\n`;

    return content;
}

/**
 * Export chat history as JSON format
 * @param {Object} chat - Chat object with messages
 * @param {Array} personas - List of personas for name resolution
 * @returns {string} JSON content
 */
export function exportAsJSON(chat, personas) {
    const getSenderName = (senderId) => {
        if (senderId === 'user-me') return 'You';
        const persona = personas.find(p => p.id === senderId);
        return persona?.name || 'Unknown';
    };

    const exportData = {
        exportInfo: {
            chatName: chat.name,
            exportDate: new Date().toISOString(),
            totalMessages: chat.messages.length,
            participants: chat.participants.map(p => ({
                id: p,
                name: getSenderName(p)
            }))
        },
        chat: {
            id: chat.id,
            name: chat.name,
            createdAt: chat.createdAt,
            participants: chat.participants,
            messages: chat.messages.map(msg => ({
                ...msg,
                senderName: getSenderName(msg.senderId)
            }))
        }
    };

    return JSON.stringify(exportData, null, 2);
}

/**
 * Export chat history as HTML format
 * @param {Object} chat - Chat object with messages
 * @param {Array} personas - List of personas for name resolution
 * @param {string} currentUserName - Current user's name
 * @returns {string} HTML content
 */
export function exportAsHTML(chat, personas, currentUserName = 'You') {
    const getSenderName = (senderId) => {
        if (senderId === 'user-me') return currentUserName;
        const persona = personas.find(p => p.id === senderId);
        return persona?.name || 'Unknown';
    };

    const getAvatar = (senderId) => {
        if (senderId === 'user-me') return '';
        const persona = personas.find(p => p.id === senderId);
        return persona?.avatar || '';
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN');
    };

    const escapeHTML = (str) => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    let messagesHTML = chat.messages.map(msg => {
        const isMe = msg.senderId === 'user-me';
        const sender = getSenderName(msg.senderId);
        const avatar = getAvatar(msg.senderId);
        const time = formatDate(msg.timestamp);
        const content = escapeHTML(msg.content).replace(/\n/g, '<br>');

        return `
        <div class="message ${isMe ? 'message-me' : 'message-other'}">
            <div class="message-avatar">
                ${avatar ? `<img src="${avatar}" alt="${sender}">` : `<div class="avatar-placeholder">${sender.charAt(0)}</div>`}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="sender">${sender}</span>
                    <span class="time">${time}</span>
                </div>
                <div class="message-body">${content}</div>
            </div>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Export - ${escapeHTML(chat.name)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .chat-info {
            padding: 20px 30px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        .chat-info p { margin: 4px 0; color: #6c757d; font-size: 14px; }
        .messages {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .message {
            display: flex;
            gap: 12px;
            max-width: 80%;
        }
        .message-me {
            flex-direction: row-reverse;
            margin-left: auto;
        }
        .message-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            overflow: hidden;
            flex-shrink: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .message-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 16px;
        }
        .message-content {
            background: #f1f3f4;
            padding: 12px 16px;
            border-radius: 18px;
            border-top-left-radius: 4px;
        }
        .message-me .message-content {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-top-left-radius: 18px;
            border-top-right-radius: 4px;
        }
        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        .message-me .message-header { flex-direction: row-reverse; }
        .sender {
            font-weight: 600;
            font-size: 13px;
            color: #667eea;
        }
        .message-me .sender { color: rgba(255,255,255,0.9); }
        .time {
            font-size: 11px;
            color: #9aa0a6;
        }
        .message-me .time { color: rgba(255,255,255,0.7); }
        .message-body {
            font-size: 14px;
            line-height: 1.5;
            word-wrap: break-word;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #9aa0a6;
            font-size: 12px;
            border-top: 1px solid #e9ecef;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHTML(chat.name)}</h1>
            <p>Exported on ${new Date().toLocaleString()}</p>
        </div>
        <div class="chat-info">
            <p><strong>Participants:</strong> ${chat.participants.map(getSenderName).join(', ')}</p>
            <p><strong>Total Messages:</strong> ${chat.messages.length}</p>
        </div>
        <div class="messages">
            ${messagesHTML}
        </div>
        <div class="footer">
            Exported from Chat Buddy
        </div>
    </div>
</body>
</html>`;
}

/**
 * Download content as a file
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Main export function
 * @param {Object} chat - Chat object
 * @param {Array} personas - List of personas
 * @param {string} format - Export format (txt, json, html)
 * @param {string} currentUserName - Current user's name
 */
export function exportChat(chat, personas, format = 'txt', currentUserName = 'You') {
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeChatName = chat.name.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');

    switch (format.toLowerCase()) {
        case 'txt':
            downloadFile(
                exportAsTXT(chat, personas, currentUserName),
                `${safeChatName}_${timestamp}.txt`,
                'text/plain;charset=utf-8'
            );
            break;
        case 'json':
            downloadFile(
                exportAsJSON(chat, personas),
                `${safeChatName}_${timestamp}.json`,
                'application/json;charset=utf-8'
            );
            break;
        case 'html':
            downloadFile(
                exportAsHTML(chat, personas, currentUserName),
                `${safeChatName}_${timestamp}.html`,
                'text/html;charset=utf-8'
            );
            break;
        default:
            throw new Error(`Unsupported export format: ${format}`);
    }
}
