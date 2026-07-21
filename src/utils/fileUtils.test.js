import { describe, it, expect } from 'vitest';
import {
  getFileExtension,
  isFileTypeSupported,
  getFileTypeInfo,
  formatFileSize,
  validateFile,
  extractTextContent,
  MAX_FILE_SIZE,
  SUPPORTED_FILE_TYPES
} from './fileUtils';

describe('getFileExtension', () => {
  it('应该提取标准文件扩展名', () => {
    expect(getFileExtension('file.js')).toBe('js');
    expect(getFileExtension('document.pdf')).toBe('pdf');
    expect(getFileExtension('script.py')).toBe('py');
  });

  it('应该处理多点文件名', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
    expect(getFileExtension('my.file.name.txt')).toBe('txt');
  });

  it('应该返回小写扩展名', () => {
    expect(getFileExtension('FILE.TXT')).toBe('txt');
    expect(getFileExtension('Script.JS')).toBe('js');
  });

  it('应该处理没有扩展名的文件', () => {
    // 对于没有点的文件名，会返回小写的文件名本身
    expect(getFileExtension('README')).toBe('readme');
    expect(getFileExtension('Makefile')).toBe('makefile');
  });

  it('应该处理以点开头的文件', () => {
    expect(getFileExtension('.gitignore')).toBe('gitignore');
    expect(getFileExtension('.env')).toBe('env');
  });

  it('应该处理空字符串', () => {
    expect(getFileExtension('')).toBe('');
  });

  it('应该处理只有扩展名的情况', () => {
    expect(getFileExtension('.txt')).toBe('txt');
  });
});

describe('isFileTypeSupported', () => {
  it('应该识别支持的文本文件', () => {
    expect(isFileTypeSupported('file.txt')).toBe(true);
    expect(isFileTypeSupported('README.md')).toBe(true);
  });

  it('应该识别支持的代码文件', () => {
    const supported = ['file.js', 'script.py', 'index.html', 'style.css', 'data.json'];
    supported.forEach(filename => {
      expect(isFileTypeSupported(filename)).toBe(true);
    });
  });

  it('应该识别支持的数据文件', () => {
    expect(isFileTypeSupported('data.csv')).toBe(true);
    expect(isFileTypeSupported('config.yaml')).toBe(true);
    expect(isFileTypeSupported('config.yml')).toBe(true);
  });

  it('应该拒绝不支持的文件类型', () => {
    const unsupported = ['file.exe', 'archive.zip', 'image.png', 'video.mp4'];
    unsupported.forEach(filename => {
      expect(isFileTypeSupported(filename)).toBe(false);
    });
  });

  it('应该大小写不敏感', () => {
    expect(isFileTypeSupported('FILE.TXT')).toBe(true);
    expect(isFileTypeSupported('Script.JS')).toBe(true);
  });

  it('应该处理没有扩展名的文件', () => {
    expect(isFileTypeSupported('README')).toBe(false);
  });
});

describe('getFileTypeInfo', () => {
  it('应该返回文本文件的正确信息', () => {
    const info = getFileTypeInfo('file.txt');
    expect(info).toEqual({
      mime: 'text/plain',
      icon: '📄',
      category: 'text'
    });
  });

  it('应该返回代码文件的正确信息', () => {
    const jsInfo = getFileTypeInfo('script.js');
    expect(jsInfo.category).toBe('code');
    expect(jsInfo.icon).toBe('⚡');

    const pyInfo = getFileTypeInfo('script.py');
    expect(pyInfo.category).toBe('code');
    expect(pyInfo.icon).toBe('🐍');
  });

  it('应该返回数据文件的正确信息', () => {
    const csvInfo = getFileTypeInfo('data.csv');
    expect(csvInfo.category).toBe('data');
    expect(csvInfo.icon).toBe('📊');
  });

  it('应该为不支持的文件返回默认信息', () => {
    const unknownInfo = getFileTypeInfo('file.unknown');
    expect(unknownInfo).toEqual({
      mime: 'application/octet-stream',
      icon: '📎',
      category: 'unknown'
    });
  });

  it('应该处理大写扩展名', () => {
    const info = getFileTypeInfo('FILE.TXT');
    expect(info.category).toBe('text');
  });
});

describe('formatFileSize', () => {
  it('应该格式化字节', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('应该格式化KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10240)).toBe('10.0 KB');
    expect(formatFileSize(1048575)).toBe('1024.0 KB');
  });

  it('应该格式化MB', () => {
    expect(formatFileSize(1048576)).toBe('1.00 MB');
    expect(formatFileSize(5242880)).toBe('5.00 MB');
    expect(formatFileSize(1572864)).toBe('1.50 MB');
  });

  it('应该正确四舍五入', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB'); // 1.5KB
    expect(formatFileSize(1638)).toBe('1.6 KB'); // 1.599KB
  });
});

describe('validateFile', () => {
  it('应该通过有效的文件', () => {
    const validFile = {
      name: 'test.js',
      size: 1024
    };
    const result = validateFile(validFile);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('应该拒绝超大文件', () => {
    const largeFile = {
      name: 'huge.txt',
      size: MAX_FILE_SIZE + 1
    };
    const result = validateFile(largeFile);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('file_too_large');
  });

  it('应该拒绝不支持的文件类型', () => {
    const unsupportedFile = {
      name: 'malware.exe',
      size: 1024
    };
    const result = validateFile(unsupportedFile);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('unsupported_file_type');
  });

  it('应该同时报告多个错误', () => {
    const invalidFile = {
      name: 'huge.exe',
      size: MAX_FILE_SIZE + 1
    };
    const result = validateFile(invalidFile);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors).toContain('file_too_large');
    expect(result.errors).toContain('unsupported_file_type');
  });

  it('应该接受恰好在大小限制内的文件', () => {
    const maxSizeFile = {
      name: 'max.txt',
      size: MAX_FILE_SIZE
    };
    const result = validateFile(maxSizeFile);
    expect(result.valid).toBe(true);
  });

  it('应该处理所有支持的文件类型', () => {
    Object.keys(SUPPORTED_FILE_TYPES).forEach(ext => {
      const file = {
        name: `test.${ext}`,
        size: 1024
      };
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });
  });
});

describe('extractTextContent', () => {
  it('应该格式化JSON文件', () => {
    const fileData = {
      content: '{"name":"test","value":123}',
      type: 'json'
    };
    const result = extractTextContent(fileData);
    expect(result).toContain('"name"');
    expect(result).toContain('"test"');
    expect(result).toContain('123');
    // 应该有格式化（缩进）
    expect(result.split('\n').length).toBeGreaterThan(1);
  });

  it('应该处理格式错误的JSON', () => {
    const fileData = {
      content: '{invalid json}',
      type: 'json'
    };
    const result = extractTextContent(fileData);
    expect(result).toBe('{invalid json}'); // 返回原始内容
  });

  it('应该保持CSV内容不变', () => {
    const csvContent = 'name,age,city\nJohn,30,NYC\nJane,25,LA';
    const fileData = {
      content: csvContent,
      type: 'csv'
    };
    const result = extractTextContent(fileData);
    expect(result).toBe(csvContent);
  });

  it('应该移除HTML标签', () => {
    const fileData = {
      content: '<div><p>Hello <strong>World</strong></p><br /></div>',
      type: 'html'
    };
    const result = extractTextContent(fileData);
    expect(result).toBe('Hello World');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('应该处理复杂的HTML', () => {
    const fileData = {
      content: `<html>
        <head><title>Test</title></head>
        <body>
          <h1>Header</h1>
          <p>Paragraph   with   spaces</p>
        </body>
      </html>`,
      type: 'html'
    };
    const result = extractTextContent(fileData);
    expect(result).toContain('Header');
    expect(result).toContain('Paragraph');
    // 多余空格应该被压缩
    expect(result).not.toContain('   ');
  });

  it('应该保持纯文本文件不变', () => {
    const textContent = 'This is plain text content.';
    const fileData = {
      content: textContent,
      type: 'txt'
    };
    const result = extractTextContent(fileData);
    expect(result).toBe(textContent);
  });

  it('应该保持Markdown文件不变', () => {
    const mdContent = '# Header\n\n**Bold** text';
    const fileData = {
      content: mdContent,
      type: 'md'
    };
    const result = extractTextContent(fileData);
    expect(result).toBe(mdContent);
  });

  it('应该处理空内容', () => {
    const fileData = {
      content: '',
      type: 'txt'
    };
    const result = extractTextContent(fileData);
    expect(result).toBe('');
  });

  it('应该处理嵌套的JSON', () => {
    const fileData = {
      content: JSON.stringify({
        user: {
          name: 'Test',
          details: {
            age: 30,
            city: 'NYC'
          }
        }
      }),
      type: 'json'
    };
    const result = extractTextContent(fileData);
    expect(result).toContain('"user"');
    expect(result).toContain('"details"');
    expect(result).toContain('"NYC"');
  });
});
