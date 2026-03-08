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
 * BM25 parameters
 */
const BM25_K1 = 1.5;
const BM25_B = 0.75;
const EMBEDDING_DIM = 256;

function hashToken(token, dim = EMBEDDING_DIM) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % dim;
}

export function buildLightweightEmbedding(text, dim = EMBEDDING_DIM) {
    const vector = new Array(dim).fill(0);
    const tokens = text.toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    if (tokens.length === 0) return vector;

    for (const token of tokens) {
        const idx = hashToken(token, dim);
        vector[idx] += 1;
    }

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm > 0) {
        for (let i = 0; i < vector.length; i++) {
            vector[i] = vector[i] / norm;
        }
    }

    return vector;
}

export function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
        return 0;
    }
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += (vecA[i] || 0) * (vecB[i] || 0);
    }
    return dot;
}

/**
 * Calculate BM25 score for a chunk given a query
 * BM25 provides better term-frequency normalization for longer documents
 */
export function calculateBM25Score(queryKeywords, chunkContent, avgDocLength) {
    const words = chunkContent.toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);

    const chunkLength = words.length;
    const tf = {};
    for (const word of words) tf[word] = (tf[word] || 0) + 1;

    let score = 0;
    for (const term of queryKeywords) {
        if (!tf[term]) continue;
        const termFreq = tf[term];
        const normalizedTF = (termFreq * (BM25_K1 + 1)) /
            (termFreq + BM25_K1 * (1 - BM25_B + BM25_B * (chunkLength / Math.max(avgDocLength, 1))));
        score += normalizedTF;
    }
    return score;
}

/**
 * Hybrid search: combines BM25 score with Jaccard similarity
 * Normalizes both scores and averages them for better recall
 */
function hybridScore(bm25, jaccard, vectorScore, bm25Max) {
    const normalizedBM25 = bm25Max > 0 ? bm25 / bm25Max : 0;
    return 0.5 * normalizedBM25 + 0.3 * jaccard + 0.2 * Math.max(0, vectorScore);
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
        keywords: extractKeywords(chunk),
        embedding: buildLightweightEmbedding(chunk)
    }));
}

/**
 * Search indexed chunks for relevant content
 * Uses hybrid BM25 + Jaccard scoring for improved recall
 */
export function searchDocuments(query, indexedChunks, topK = 3) {
    if (indexedChunks.length === 0) return [];
    const queryKeywords = extractKeywords(query);
    if (queryKeywords.length === 0) return [];
    const queryEmbedding = buildLightweightEmbedding(query);

    // Compute average document length for BM25 normalization
    const avgDocLength = indexedChunks.reduce((sum, c) =>
        sum + c.content.split(/\s+/).length, 0) / indexedChunks.length;

    // First pass: compute raw BM25 and Jaccard scores
    const scored = indexedChunks.map(chunk => {
        const bm25 = calculateBM25Score(queryKeywords, chunk.content, avgDocLength);
        const jaccard = calculateSimilarity(queryKeywords, chunk.keywords);
        const embedding = Array.isArray(chunk.embedding)
            ? chunk.embedding
            : buildLightweightEmbedding(chunk.content);
        const vectorScore = cosineSimilarity(queryEmbedding, embedding);
        return { ...chunk, bm25, jaccard, vectorScore, embedding };
    });

    // Normalize BM25 by the max in the result set
    const bm25Max = Math.max(...scored.map(c => c.bm25), 1);

    return scored
        .map(chunk => ({
            ...chunk,
            score: hybridScore(chunk.bm25, chunk.jaccard, chunk.vectorScore, bm25Max)
        }))
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
export function addDocumentToIndex(document, existingIndex = null, options = { persist: true }) {
    const baseIndex = Array.isArray(existingIndex) ? existingIndex : loadIndex();
    // Remove existing chunks for this document
    const filteredIndex = baseIndex.filter(c => c.documentId !== document.id);
    // Add new chunks
    const newChunks = indexDocument(document);
    const updatedIndex = [...filteredIndex, ...newChunks];
    if (options.persist !== false) {
        saveIndex(updatedIndex);
    }
    return updatedIndex;
}

/**
 * Remove document from index
 */
export function removeDocumentFromIndex(documentId, existingIndex = null, options = { persist: true }) {
    const baseIndex = Array.isArray(existingIndex) ? existingIndex : loadIndex();
    const updatedIndex = baseIndex.filter(c => c.documentId !== documentId);
    if (options.persist !== false) {
        saveIndex(updatedIndex);
    }
    return updatedIndex;
}
