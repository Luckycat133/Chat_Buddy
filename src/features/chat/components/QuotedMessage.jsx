import React from 'react';
import { cn } from '../../../utils/cn';

export default function QuotedMessage({ quotedMessage, senderName, onClick }) {

    if (!quotedMessage) return null;

    // Truncate long messages
    const maxLength = 50;
    const displayContent = quotedMessage.content.length > maxLength
        ? quotedMessage.content.slice(0, maxLength) + '...'
        : quotedMessage.content;

    return (
        <div
            onClick={onClick}
            className={cn(
                "px-2 py-1 mb-1 border-l-2 border-[var(--color-primary)] bg-black/5 rounded-r",
                "text-xs text-gray-600 cursor-pointer hover:bg-black/10 transition-colors"
            )}
        >
            <span className="font-medium text-[var(--color-primary)]">
                {senderName}
            </span>
            <p className="text-gray-500 truncate">{displayContent}</p>
        </div>
    );
}
