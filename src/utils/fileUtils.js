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

// Allowed MIME types mapped to their valid extensions
// This maps both the primary MIME type and common variants
export const ALLOWED_MIME_TYPES = {
    'text/plain': ['txt', 'md', 'json', 'js', 'ts', 'py', 'html', 'css', 'xml', 'csv', 'yaml', 'yml'],
    'text/markdown': ['md'],
    'application/json': ['json'],
    'application/javascript': ['js'],
    'text/javascript': ['js'],
    'application/typescript': ['ts'],
    'text/typescript': ['ts'],
    'text/x-python': ['py'],
    'text/html': ['html'],
    'text/css': ['css'],
    'application/xml': ['xml'],
    'text/xml': ['xml'],
    'text/csv': ['csv'],
    'text/yaml': ['yaml', 'yml'],
    'application/x-yaml': ['yaml', 'yml']
};

// Set of allowed MIME types for quick lookup
const ALLOWED_MIME_SET = new Set(Object.keys(ALLOWED_MIME_TYPES));

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
 * Validate file for upload with security checks
 * Checks: file size, MIME type, extension, and MIME-extension consistency
 */
export function validateFile(file) {
    const errors = [];

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        errors.push('file_too_large');
    }

    // Check file extension
    const ext = getFileExtension(file.name);
    if (!isFileTypeSupported(file.name)) {
        errors.push('unsupported_file_type');
    }

    // Check MIME type is allowed
    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_SET.has(mimeType)) {
        errors.push('unsupported_mime_type');
    }

    // Check extension matches MIME type
    const validExtensions = ALLOWED_MIME_TYPES[mimeType];
    if (validExtensions && ext && !validExtensions.includes(ext)) {
        errors.push('extension_mime_mismatch');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate file content by checking for valid text encoding
 * This helps detect files that claim to be text but contain binary content
 */
export async function validateFileContent(file) {
    // Only validate text-based files
    const textMimeTypes = ['text/', 'application/json', 'application/javascript',
                           'application/typescript', 'application/xml', 'application/x-yaml'];
    const isTextFile = textMimeTypes.some(type => file.type?.startsWith(type) || file.type === type);

    if (!isTextFile) {
        return { valid: true, errors: [] };
    }

    const errors = [];

    try {
        // Read first portion of file to check for null bytes (binary indicator)
        const chunk = file.slice(0, 8192); // Read first 8KB
        const buffer = await chunk.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Check for null bytes (common in binary files)
        const hasNullBytes = bytes.some(byte => byte === 0);
        if (hasNullBytes) {
            errors.push('binary_content_detected');
        }

        // For JSON files, validate structure
        if (file.name.endsWith('.json')) {
            try {
                const text = new TextDecoder().decode(buffer);
                JSON.parse(text);
            } catch (e) {
                console.warn('[fileUtils] JSON validation failed:', e?.message);
                errors.push('invalid_json_content');
            }
        }
    } catch (e) {
        console.warn('[fileUtils] Content read error:', e?.message);
        errors.push('content_read_error');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Comprehensive file validation combining all checks
 * Use this for security-critical file uploads
 */
export async function validateFileComprehensive(file) {
    const basicValidation = validateFile(file);

    if (!basicValidation.valid) {
        return basicValidation;
    }

    const contentValidation = await validateFileContent(file);

    return {
        valid: contentValidation.valid,
        errors: [...basicValidation.errors, ...contentValidation.errors]
    };
}

/**
 * Process file for chat
 * Returns file data object for storing in message
 * Uses comprehensive validation for security
 */
export async function processFileForChat(file) {
    const validation = await validateFileComprehensive(file);
    if (!validation.valid) {
        throw new Error(validation.errors[0]);
    }

    const content = await readFileAsText(file);
    const typeInfo = getFileTypeInfo(file.name);

    return {
        name: file.name,
        size: file.size,
        type: getFileExtension(file.name),
        mimeType: file.type,
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
            case 'json': {
                // Pretty print JSON for better readability
                const parsed = JSON.parse(content);
                return JSON.stringify(parsed, null, 2);
            }
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
