/**
 * File generation utilities for AI-generated files
 */

import { getFileTypeInfo } from './fileUtils';

/**
 * Generate a downloadable file and create blob URL
 */
export function generateFile(filename, content) {
    const extension = filename.split('.').pop()?.toLowerCase() || 'txt';
    const typeInfo = getFileTypeInfo(filename);

    const blob = new Blob([content], { type: typeInfo.mime });
    const url = URL.createObjectURL(blob);

    return {
        filename,
        content,
        extension,
        icon: typeInfo.icon,
        size: blob.size,
        url,
        createdAt: new Date().toISOString()
    };
}

/**
 * Parse AI response for file generation commands
 * Format: [FILE:filename.ext:content] or [FILE:filename.ext]content[/FILE]
 */
export function parseFileCommands(response) {
    const files = [];
    let cleanedResponse = response;

    // Pattern 1: [FILE:filename:content]
    const simplePattern = /\[FILE:([^:]+):([^\]]+)\]/g;
    let match;

    while ((match = simplePattern.exec(response)) !== null) {
        const [fullMatch, filename, content] = match;
        files.push(generateFile(filename.trim(), content.trim()));
        cleanedResponse = cleanedResponse.replace(fullMatch, '');
    }

    // Pattern 2: [FILE:filename]content[/FILE]
    const blockPattern = /\[FILE:([^\]]+)\]([\s\S]*?)\[\/FILE\]/g;

    while ((match = blockPattern.exec(response)) !== null) {
        const [fullMatch, filename, content] = match;
        files.push(generateFile(filename.trim(), content.trim()));
        cleanedResponse = cleanedResponse.replace(fullMatch, '');
    }

    // Pattern 3: Code blocks with filename hint
    // ```python:hello.py or ```filename.py
    const codeBlockPattern = /```(\w+:)?([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z]+)\n([\s\S]*?)```/g;

    while ((match = codeBlockPattern.exec(response)) !== null) {
        const [fullMatch, , filename, content] = match;
        if (filename) {
            files.push(generateFile(filename.trim(), content.trim()));
            cleanedResponse = cleanedResponse.replace(fullMatch, '');
        }
    }

    return {
        files,
        cleanedResponse: cleanedResponse.trim()
    };
}

/**
 * Download a generated file
 */
export function downloadGeneratedFile(fileData) {
    const a = document.createElement('a');
    a.href = fileData.url;
    a.download = fileData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Cleanup blob URLs when no longer needed
 */
export function cleanupFileUrl(fileData) {
    if (fileData?.url) {
        URL.revokeObjectURL(fileData.url);
    }
}

/**
 * Get syntax highlighting language from file extension
 */
export function getSyntaxLanguage(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml',
        'sql': 'sql',
        'sh': 'bash',
        'bash': 'bash'
    };
    return languageMap[ext] || 'plaintext';
}

/**
 * Format code for display (add line numbers)
 */
export function formatCodeWithLineNumbers(content) {
    const lines = content.split('\n');
    return lines.map((line, i) => ({
        number: i + 1,
        content: line
    }));
}
