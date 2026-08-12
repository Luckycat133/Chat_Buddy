import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../utils/cn';

const CODE_LANGUAGES = {
    bash, csharp, css, go, java, javascript, json, jsx, kotlin,
    markdown, markup, python, rust, sql, swift, tsx, typescript, yaml,
};

Object.entries(CODE_LANGUAGES).forEach(([name, grammar]) => {
    SyntaxHighlighter.registerLanguage(name, grammar);
});

SyntaxHighlighter.alias('javascript', ['js']);
SyntaxHighlighter.alias('typescript', ['ts']);
SyntaxHighlighter.alias('python', ['py']);
SyntaxHighlighter.alias('bash', ['sh', 'shell', 'zsh']);
SyntaxHighlighter.alias('markup', ['html', 'xml']);

const SUPPORTED_LANGUAGES = new Set([
    ...Object.keys(CODE_LANGUAGES),
    'js', 'ts', 'py', 'sh', 'shell', 'zsh', 'html', 'xml',
]);

export default function MarkdownCodeBlock({ language, children }) {
    const { t } = useLanguage();
    const { isDarkMode } = useTheme();
    const [copied, setCopied] = useState(false);

    const codeTheme = isDarkMode ? vscDarkPlus : vs;
    const codeBgClass = isDarkMode ? '!bg-black/80 border-white/10' : '!bg-gray-50 border-gray-200';
    const codeText = String(children).replace(/\n$/, '');
    const normalizedLanguage = String(language || '').toLowerCase();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(codeText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    return (
        <div className="relative group/code my-2">
            <button
                onClick={handleCopy}
                className={cn(
                    "absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
                    "min-h-11 transition-all duration-200 opacity-0 group-hover/code:opacity-100 group-focus-within/code:opacity-100 focus:opacity-100",
                    "bg-[var(--color-bg-white)]/90 hover:bg-[var(--color-bg-white)]",
                    "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]",
                    "border border-[var(--color-border)] shadow-sm",
                    copied && "opacity-100 !text-green-600 !bg-green-50"
                )}
                title={t('copy_code')}
                aria-label={t('copy_code')}
            >
                {copied ? (
                    <>
                        <Check size={14} />
                        <span>{t('copied')}</span>
                    </>
                ) : (
                    <>
                        <Copy size={14} />
                        <span>{t('copy_code')}</span>
                    </>
                )}
            </button>

            <SyntaxHighlighter
                style={codeTheme}
                {...(SUPPORTED_LANGUAGES.has(normalizedLanguage) ? { language: normalizedLanguage } : {})}
                PreTag="div"
                className={cn("rounded-md !p-3 shadow-sm border", codeBgClass)}
            >
                {codeText}
            </SyntaxHighlighter>
        </div>
    );
}
