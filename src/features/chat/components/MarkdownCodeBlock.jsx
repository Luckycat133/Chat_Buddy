import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useLanguage } from '../../../context/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../utils/cn';

export default function MarkdownCodeBlock({ language, children }) {
    const { t } = useLanguage();
    const { isDarkMode } = useTheme();
    const [copied, setCopied] = useState(false);

    const codeTheme = isDarkMode ? vscDarkPlus : vs;
    const codeBgClass = isDarkMode ? '!bg-black/80 border-white/10' : '!bg-gray-50 border-gray-200';
    const codeText = String(children).replace(/\n$/, '');

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
                    "transition-all duration-200 opacity-0 group-hover/code:opacity-100",
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
                language={language}
                PreTag="div"
                className={cn("rounded-md !p-3 shadow-sm border", codeBgClass)}
            >
                {codeText}
            </SyntaxHighlighter>
        </div>
    );
}
