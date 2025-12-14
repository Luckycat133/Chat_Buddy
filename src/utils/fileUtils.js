/**
 * File utilities for handling file uploads and processing
 */

// Supported file types and their MIME types
export const SUPPORTED_FILE_TYPES = {
    'txt': { mime: 'text/plain', icon: '📄', category: 'text' },
    'md': { mime: 'text/markdown', icon: '📝', category: 'text' },
    'json': { mime: 'application/json', icon: '📋', category: 'code' },
    'js': { mime: 'application/javascript', icon: '⚡', category: 'code' },
    'ts': { mime: 'application/typescript', icon: '🔷', category: 'code' },
    'py': { mime: 'text/x-python', icon: '🐍', category: 'code' },
    'html': { mime: 'text/html', icon: '🌐', category: 'code' },
    'css': { mime: 'text/css', icon: '🎨', category: 'code' },
    'xml': { mime: 'application/xml', icon: '📰', category: 'code' },
    'csv': { mime: 'text/csv', icon: '📊', category: 'data' },
    'yaml': { mime: 'text/yaml', icon: '📑', category: 'config' },
    'yml': { mime: 'text/yaml', icon: '📑', category: 'config' }
};

// Maximum file size (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Get file extension from filename
 */
export function getFileExtension(filename) {
    return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if file type is supported
 */
export function isFileTypeSupported(filename) {
    const ext = getFileExtension(filename);
    return ext in SUPPORTED_FILE_TYPES;
}

/**
 * Get file type info
 */
export function getFileTypeInfo(filename) {
    const ext = getFileExtension(filename);
    return SUPPORTED_FILE_TYPES[ext] || { mime: 'application/octet-stream', icon: '📎', category: 'unknown' };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Read file as text
 */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

/**
 * Read file as base64
 */
export function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Validate file for upload
 */
export function validateFile(file) {
    const errors = [];

    if (file.size > MAX_FILE_SIZE) {
        errors.push('file_too_large');
    }

    if (!isFileTypeSupported(file.name)) {
        errors.push('unsupported_file_type');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Process file for chat
 * Returns file data object for storing in message
 */
export async function processFileForChat(file) {
    const validation = validateFile(file);
    if (!validation.valid) {
        throw new Error(validation.errors[0]);
    }

    const content = await readFileAsText(file);
    const typeInfo = getFileTypeInfo(file.name);

    return {
        name: file.name,
        size: file.size,
        type: getFileExtension(file.name),
        icon: typeInfo.icon,
        category: typeInfo.category,
        content: content,
        uploadedAt: new Date().toISOString()
    };
}

/**
 * Create a downloadable file from content
 */
export function downloadFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Extract text content for RAG indexing
 * Handles different file types appropriately
 */
export function extractTextContent(fileData) {
    const { content, type } = fileData;

    try {
        switch (type) {
            case 'json':
                // Pretty print JSON for better readability
                const parsed = JSON.parse(content);
                return JSON.stringify(parsed, null, 2);
            case 'csv':
                // CSV is already text
                return content;
            case 'html':
                // Strip HTML tags
                return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            default:
                return content;
        }
    } catch {
        return content;
    }
}
