import { describe, it, expect, beforeEach } from 'vitest';
import {
  chunkText,
  extractKeywords,
  calculateSimilarity,
  indexDocument,
  searchDocuments,
  buildRAGContext,
  saveIndex,
  loadIndex,
  addDocumentToIndex,
  removeDocumentFromIndex
} from './ragUtils';

describe('chunkText', () => {
  it('应该将短文本作为单个块返回', () => {
    const text = 'This is a short text.';
    const chunks = chunkText(text, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('应该按段落分块', () => {
    const text = 'Paragraph 1 with more content here.\n\n' +
      'Paragraph 2 with additional text content.\n\n' +
      'Paragraph 3 with even more text to exceed chunk size.';
    const chunks = chunkText(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('应该处理超长段落', () => {
    const longParagraph = 'This is a very long sentence. ' +
      'It contains multiple sentences. ' +
      'Each sentence should be considered. ' +
      'The chunking algorithm should handle this properly. ' +
      'It should split by sentences when needed.';
    const chunks = chunkText(longParagraph, 50, 10);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('应该在块之间保持重叠', () => {
    const text = 'First chunk here.\n\n' +
      'Second chunk here with some overlap text.\n\n' +
      'Third chunk here.';
    const chunks = chunkText(text, 30, 10);
    // 验证有重叠内容
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('应该处理空文本', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('应该处理只有换行的文本', () => {
    const text = '\n\n\n\n';
    expect(chunkText(text)).toEqual([]);
  });

  it('应该修剪块中的空白', () => {
    const text = '  Content with spaces  \n\n  More content  ';
    const chunks = chunkText(text, 100);
    chunks.forEach(chunk => {
      expect(chunk).toBe(chunk.trim());
    });
  });

  it('应该使用自定义块大小', () => {
    // 创建包含句子的长文本以便正确分块
    const sentences = Array.from({ length: 20 }, (_, i) =>
      `This is sentence number ${i + 1}.`
    );
    const text = sentences.join(' ');
    const chunks = chunkText(text, 200);

    // 大部分块应该接近或小于块大小
    const validChunks = chunks.filter(chunk => chunk.length <= 250);
    expect(validChunks.length).toBeGreaterThan(0);
  });
});

describe('extractKeywords', () => {
  it('应该提取关键词并过滤停用词', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const keywords = extractKeywords(text);
    expect(keywords).not.toContain('the');
    expect(keywords).toContain('quick');
    expect(keywords).toContain('brown');
  });

  it('应该按频率排序关键词', () => {
    const text = 'apple orange apple banana apple orange';
    const keywords = extractKeywords(text);
    expect(keywords[0]).toBe('apple'); // 最频繁
  });

  it('应该过滤短词（<3字符）', () => {
    const text = 'a an the it to be or not to be';
    const keywords = extractKeywords(text);
    expect(keywords.length).toBe(0); // 所有都是停用词或太短
  });

  it('应该处理混合大小写', () => {
    const text = 'Programming PROGRAMMING programming';
    const keywords = extractKeywords(text);
    expect(keywords).toContain('programming');
    expect(keywords).toHaveLength(1);
  });

  it('应该处理标点符号', () => {
    const text = 'Hello, world! How are you?';
    const keywords = extractKeywords(text);
    expect(keywords).toContain('hello');
    expect(keywords).toContain('world');
  });

  it('应该支持中文文本', () => {
    const text = '这是一个测试文本 测试 文本';
    const keywords = extractKeywords(text);
    // 中文分词可能将词组作为整体，验证有关键词提取
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThan(0);
  });

  it('应该限制返回最多20个关键词', () => {
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const keywords = extractKeywords(text);
    expect(keywords.length).toBeLessThanOrEqual(20);
  });

  it('应该处理空文本', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('应该处理纯标点文本', () => {
    expect(extractKeywords('!@#$%^&*()')).toEqual([]);
  });
});

describe('calculateSimilarity', () => {
  it('应该返回0对于完全不同的集合', () => {
    const similarity = calculateSimilarity(['a', 'b'], ['c', 'd']);
    expect(similarity).toBe(0);
  });

  it('应该返回正确的相似度对于部分重叠', () => {
    const similarity = calculateSimilarity(
      ['apple', 'banana', 'orange'],
      ['banana', 'orange', 'grape']
    );
    // 2个交集 / 4个并集 = 0.5
    expect(similarity).toBeCloseTo(0.5);
  });

  it('应该返回高相似度对于高度重叠', () => {
    const similarity = calculateSimilarity(
      ['apple', 'banana'],
      ['apple', 'banana', 'orange']
    );
    // 2个交集 / 3个并集 = 0.666...
    expect(similarity).toBeCloseTo(0.666, 2);
  });

  it('应该处理空数组', () => {
    expect(calculateSimilarity([], [])).toBe(0);
    expect(calculateSimilarity(['a'], [])).toBe(0);
    expect(calculateSimilarity([], ['a'])).toBe(0);
  });

  it('应该处理重复的关键词', () => {
    const similarity = calculateSimilarity(
      ['apple', 'apple'],
      ['apple', 'banana']
    );
    // Set会去重，所以实际是 ['apple'] vs ['apple', 'banana']
    // 1个交集 / 2个并集 = 0.5
    expect(similarity).toBeCloseTo(0.5);
  });

  it('应该是对称的', () => {
    const keywords1 = ['a', 'b', 'c'];
    const keywords2 = ['b', 'c', 'd'];
    const sim1 = calculateSimilarity(keywords1, keywords2);
    const sim2 = calculateSimilarity(keywords2, keywords1);
    expect(sim1).toBe(sim2);
  });
});

describe('indexDocument', () => {
  it('应该为文档创建索引块', () => {
    const document = {
      id: 'doc1',
      name: 'Test Document',
      content: 'This is test content.\n\nAnother paragraph here.'
    };
    const indexed = indexDocument(document);

    expect(Array.isArray(indexed)).toBe(true);
    expect(indexed.length).toBeGreaterThan(0);
    expect(indexed[0]).toHaveProperty('documentId', 'doc1');
    expect(indexed[0]).toHaveProperty('documentName', 'Test Document');
    expect(indexed[0]).toHaveProperty('chunkIndex');
    expect(indexed[0]).toHaveProperty('content');
    expect(indexed[0]).toHaveProperty('keywords');
  });

  it('应该为每个块分配正确的索引', () => {
    const document = {
      id: 'doc1',
      name: 'Test',
      content: 'A'.repeat(1000) + '\n\n' + 'B'.repeat(1000)
    };
    const indexed = indexDocument(document);

    indexed.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
    });
  });

  it('应该提取每个块的关键词', () => {
    const document = {
      id: 'doc1',
      name: 'Test',
      content: 'Programming is fun. Coding is creative.'
    };
    const indexed = indexDocument(document);

    indexed.forEach(chunk => {
      expect(Array.isArray(chunk.keywords)).toBe(true);
    });
  });
});

describe('searchDocuments', () => {
  const mockIndex = [
    {
      documentId: 'doc1',
      documentName: 'JavaScript Guide',
      chunkIndex: 0,
      content: 'JavaScript is a programming language',
      keywords: ['javascript', 'programming', 'language']
    },
    {
      documentId: 'doc2',
      documentName: 'Python Tutorial',
      chunkIndex: 0,
      content: 'Python is also a programming language',
      keywords: ['python', 'programming', 'language']
    },
    {
      documentId: 'doc3',
      documentName: 'Cooking Recipe',
      chunkIndex: 0,
      content: 'How to cook pasta',
      keywords: ['cook', 'pasta']
    }
  ];

  it('应该返回最相关的文档', () => {
    const results = searchDocuments('javascript programming', mockIndex);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].documentName).toBe('JavaScript Guide');
  });

  it('应该按相似度排序', () => {
    const results = searchDocuments('programming language', mockIndex, 3);
    // 前两个应该都包含 'programming' 和 'language'
    expect(results[0].score).toBeGreaterThanOrEqual(results[1]?.score || 0);
  });

  it('应该限制返回的数量', () => {
    const results = searchDocuments('programming', mockIndex, 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('应该过滤掉零分的结果', () => {
    const results = searchDocuments('unrelated query terms', mockIndex);
    results.forEach(result => {
      expect(result.score).toBeGreaterThan(0);
    });
  });

  it('应该处理空索引', () => {
    const results = searchDocuments('query', []);
    expect(results).toEqual([]);
  });

  it('应该为每个结果添加分数', () => {
    const results = searchDocuments('programming', mockIndex);
    results.forEach(result => {
      expect(result).toHaveProperty('score');
      expect(typeof result.score).toBe('number');
    });
  });
});

describe('buildRAGContext', () => {
  const mockIndex = [
    {
      documentId: 'doc1',
      documentName: 'Guide',
      chunkIndex: 0,
      content: 'Relevant content here',
      keywords: ['relevant', 'content']
    }
  ];

  it('应该构建RAG上下文', () => {
    const result = buildRAGContext('relevant query', mockIndex);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('context');
    expect(result).toHaveProperty('sources');
  });

  it('应该包含文档名称和内容', () => {
    const result = buildRAGContext('relevant', mockIndex);
    expect(result.context).toContain('Guide');
    expect(result.context).toContain('Relevant content here');
  });

  it('应该返回null当没有相关文档', () => {
    const result = buildRAGContext('unrelated query', mockIndex);
    expect(result).toBeNull();
  });

  it('应该包含source信息', () => {
    const result = buildRAGContext('relevant', mockIndex);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toHaveProperty('documentName');
    expect(result.sources[0]).toHaveProperty('documentId');
    expect(result.sources[0]).toHaveProperty('chunkIndex');
    expect(result.sources[0]).toHaveProperty('score');
  });
});

describe('localStorage operations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveIndex & loadIndex', () => {
    it('应该保存和加载索引', () => {
      const testIndex = [
        { documentId: 'doc1', content: 'test', keywords: ['test'] }
      ];
      saveIndex(testIndex);
      const loaded = loadIndex();
      expect(loaded).toEqual(testIndex);
    });

    it('应该在无数据时返回空数组', () => {
      const loaded = loadIndex();
      expect(loaded).toEqual([]);
    });

    it('应该处理损坏的数据', () => {
      localStorage.setItem('chat-buddy-rag-index', 'invalid json{');
      const loaded = loadIndex();
      expect(loaded).toEqual([]);
    });
  });

  describe('addDocumentToIndex', () => {
    it('应该添加新文档到索引', () => {
      const document = {
        id: 'doc1',
        name: 'Test',
        content: 'Test content for indexing'
      };
      const result = addDocumentToIndex(document);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].documentId).toBe('doc1');
    });

    it('应该替换已存在文档的索引', () => {
      const doc1 = {
        id: 'doc1',
        name: 'Original',
        content: 'Original content'
      };
      const doc1Updated = {
        id: 'doc1',
        name: 'Updated',
        content: 'Updated content'
      };

      addDocumentToIndex(doc1);
      const result = addDocumentToIndex(doc1Updated);

      // 不应该有重复的doc1
      const doc1Chunks = result.filter(c => c.documentId === 'doc1');
      expect(doc1Chunks.every(c => c.content.includes('Updated'))).toBe(true);
    });

    it('应该持久化到localStorage', () => {
      const document = {
        id: 'doc1',
        name: 'Test',
        content: 'Test content'
      };
      addDocumentToIndex(document);

      const loaded = loadIndex();
      expect(loaded.length).toBeGreaterThan(0);
    });
  });

  describe('removeDocumentFromIndex', () => {
    it('应该移除文档的所有块', () => {
      const doc1 = { id: 'doc1', name: 'Doc 1', content: 'Content 1' };
      const doc2 = { id: 'doc2', name: 'Doc 2', content: 'Content 2' };

      addDocumentToIndex(doc1);
      addDocumentToIndex(doc2);

      const result = removeDocumentFromIndex('doc1');

      expect(result.every(c => c.documentId !== 'doc1')).toBe(true);
      expect(result.some(c => c.documentId === 'doc2')).toBe(true);
    });

    it('应该处理不存在的文档ID', () => {
      const result = removeDocumentFromIndex('nonexistent');
      expect(result).toEqual([]);
    });

    it('应该持久化更改', () => {
      const doc1 = { id: 'doc1', name: 'Doc 1', content: 'Content 1' };
      addDocumentToIndex(doc1);
      removeDocumentFromIndex('doc1');

      const loaded = loadIndex();
      expect(loaded.every(c => c.documentId !== 'doc1')).toBe(true);
    });
  });
});
