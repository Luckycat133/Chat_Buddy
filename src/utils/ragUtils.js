/**
 * RAG (Retrieval Augmented Generation) utilities
 * Client-side implementation using TF-IDF keyword matching
 */

/**
 * Chunk text into smaller pieces for indexing
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Target chunk size in characters
 * @param {number} overlap - Overlap between chunks
 */
export function chunkText(text, chunkSize = 500, overlap = 100) {
    const chunks = [];
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length <= chunkSize) {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }

            // Handle paragraphs longer than chunkSize
            if (paragraph.length > chunkSize) {
                const sentences = paragraph.split(/(?<=[.!?])\s+/);
                currentChunk = '';

                for (const sentence of sentences) {
                    if (currentChunk.length + sentence.length <= chunkSize) {
                        currentChunk += (currentChunk ? ' ' : '') + sentence;
                    } else {
                        if (currentChunk) {
                            chunks.push(currentChunk.trim());
                            // Add overlap from end of previous chunk
                            currentChunk = currentChunk.slice(-overlap) + ' ' + sentence;
                        } else {
                            currentChunk = sentence;
                        }
                    }
                }
            } else {
                currentChunk = paragraph;
            }
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Extract keywords from text using simple TF analysis
 */
export function extractKeywords(text) {
    // Common stop words to filter out
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
        'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
        'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
        'above', 'below', 'between', 'under', 'again', 'further', 'then',
        'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
        'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
        'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and',
        'but', 'if', 'or', 'because', 'as', 'until', 'while', 'although',
        'though', 'after', 'before', 'since', 'when', 'where', 'this', 'that',
        'these', 'those', 'it', 'its', 'i', 'me', 'my', 'myself', 'we', 'our',
        'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
        'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
        'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
        'who', 'whom', 'whose', '。', '，', '的', '是', '在', '了', '和', '与',
        '或', '但', '如果', '因为', '所以', '这', '那', '我', '你', '他', '她', '它'
    ]);

    // Tokenize and normalize
    const words = text.toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));

    // Count term frequency
    const tf = {};
    for (const word of words) {
        tf[word] = (tf[word] || 0) + 1;
    }

    // Return sorted keywords
    return Object.entries(tf)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word]) => word);
}

/**
 * Calculate similarity between query and chunk
 * Uses term frequency overlap
 */
export function calculateSimilarity(queryKeywords, chunkKeywords) {
    const querySet = new Set(queryKeywords);
    const chunkSet = new Set(chunkKeywords);

    let matchCount = 0;
    for (const keyword of querySet) {
        if (chunkSet.has(keyword)) {
            matchCount++;
        }
    }

    // Jaccard-like similarity
    const unionSize = new Set([...querySet, ...chunkSet]).size;
    return unionSize > 0 ? matchCount / unionSize : 0;
}

/**
 * Index a document for RAG search
 */
export function indexDocument(document) {
    const { id, name, content } = document;
    const chunks = chunkText(content);

    return chunks.map((chunk, index) => ({
        documentId: id,
        documentName: name,
        chunkIndex: index,
        content: chunk,
        keywords: extractKeywords(chunk)
    }));
}

/**
 * Search indexed chunks for relevant content
 */
export function searchDocuments(query, indexedChunks, topK = 3) {
    const queryKeywords = extractKeywords(query);

    // Score each chunk
    const scoredChunks = indexedChunks.map(chunk => ({
        ...chunk,
        score: calculateSimilarity(queryKeywords, chunk.keywords)
    }));

    // Sort by score and return top K
    return scoredChunks
        .filter(chunk => chunk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}

/**
 * Build RAG context for AI prompt
 */
export function buildRAGContext(query, indexedChunks) {
    const relevantChunks = searchDocuments(query, indexedChunks);

    if (relevantChunks.length === 0) {
        return null;
    }

    const context = relevantChunks.map((chunk, _index) =>
        `[Document: ${chunk.documentName}]\n${chunk.content}`
    ).join('\n\n---\n\n');

    return {
        context,
        sources: relevantChunks.map(c => ({
            documentName: c.documentName,
            documentId: c.documentId,
            chunkIndex: c.chunkIndex,
            score: c.score
        }))
    };
}

/**
 * Storage key for document index
 */
const STORAGE_KEY = 'chat-buddy-rag-index';

/**
 * Save indexed chunks to localStorage
 */
export function saveIndex(indexedChunks) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(indexedChunks));
    } catch (e) {
        console.error('Failed to save RAG index:', e);
    }
}

/**
 * Load indexed chunks from localStorage
 */
export function loadIndex() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Failed to load RAG index:', e);
        return [];
    }
}

/**
 * Add document to index
 */
export function addDocumentToIndex(document) {
    const existingIndex = loadIndex();
    // Remove existing chunks for this document
    const filteredIndex = existingIndex.filter(c => c.documentId !== document.id);
    // Add new chunks
    const newChunks = indexDocument(document);
    const updatedIndex = [...filteredIndex, ...newChunks];
    saveIndex(updatedIndex);
    return updatedIndex;
}

/**
 * Remove document from index
 */
export function removeDocumentFromIndex(documentId) {
    const existingIndex = loadIndex();
    const updatedIndex = existingIndex.filter(c => c.documentId !== documentId);
    saveIndex(updatedIndex);
    return updatedIndex;
}
