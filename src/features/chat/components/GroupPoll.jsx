import React, { useState } from 'react';
import { X, Plus, Check, BarChart3, Users } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { cn } from '../../../utils/cn';

export default function GroupPoll({ chatId, onClose, onCreatePoll }) {
    const { language } = useLanguage();
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [isMultiChoice, setIsMultiChoice] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);

    const addOption = () => {
        if (options.length < 10) {
            setOptions([...options, '']);
        }
    };

    const removeOption = (index) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };

    const updateOption = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const isValid = question.trim() && options.filter(o => o.trim()).length >= 2;

    const handleCreate = () => {
        if (!isValid) return;

        const poll = {
            id: `poll-${Date.now()}`,
            question: question.trim(),
            options: options.filter(o => o.trim()).map((text, i) => ({
                id: `opt-${i}`,
                text,
                votes: []
            })),
            isMultiChoice,
            isAnonymous,
            createdAt: new Date().toISOString(),
            chatId
        };

        onCreatePoll?.(poll);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-[var(--color-bg-white)] rounded-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <button onClick={onClose} className="text-[var(--color-text-muted)]">
                        <X size={24} />
                    </button>
                    <h3 className="font-medium text-[17px] flex items-center gap-2">
                        <BarChart3 size={20} />
                        {language === 'zh' ? '创建投票' : 'Create Poll'}
                    </h3>
                    <button
                        onClick={handleCreate}
                        disabled={!isValid}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                            isValid
                                ? "bg-[var(--color-primary)] text-white"
                                : "bg-gray-200 text-gray-400"
                        )}
                    >
                        {language === 'zh' ? '创建' : 'Create'}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Question */}
                    <div className="mb-4">
                        <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">
                            {language === 'zh' ? '问题' : 'Question'}
                        </label>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder={language === 'zh' ? '输入投票问题...' : 'Enter your question...'}
                            maxLength={100}
                            className="w-full px-4 py-3 bg-[var(--color-bg-app)] rounded-lg text-[15px] outline-none focus:ring-2 ring-[var(--color-primary)]/30"
                        />
                    </div>

                    {/* Options */}
                    <div className="mb-4">
                        <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">
                            {language === 'zh' ? '选项' : 'Options'}
                        </label>
                        <div className="space-y-2">
                            {options.map((option, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-xs font-medium text-[var(--color-primary)]">
                                        {index + 1}
                                    </span>
                                    <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => updateOption(index, e.target.value)}
                                        placeholder={`${language === 'zh' ? '选项' : 'Option'} ${index + 1}`}
                                        maxLength={50}
                                        className="flex-1 px-3 py-2 bg-[var(--color-bg-app)] rounded-lg text-[14px] outline-none focus:ring-2 ring-[var(--color-primary)]/30"
                                    />
                                    {options.length > 2 && (
                                        <button
                                            onClick={() => removeOption(index)}
                                            className="text-[var(--color-text-muted)] hover:text-red-500"
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {options.length < 10 && (
                            <button
                                onClick={addOption}
                                className="mt-2 flex items-center gap-2 text-[var(--color-primary)] text-sm hover:bg-[var(--color-primary)]/10 px-3 py-2 rounded-lg transition-colors"
                            >
                                <Plus size={18} />
                                {language === 'zh' ? '添加选项' : 'Add option'}
                            </button>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 bg-[var(--color-bg-app)] rounded-lg cursor-pointer">
                            <div className="flex items-center gap-3">
                                <Check size={20} className="text-[var(--color-text-muted)]" />
                                <span className="text-[14px]">
                                    {language === 'zh' ? '允许多选' : 'Allow multiple choices'}
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={isMultiChoice}
                                onChange={(e) => setIsMultiChoice(e.target.checked)}
                                className="w-5 h-5 rounded accent-[var(--color-primary)]"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-[var(--color-bg-app)] rounded-lg cursor-pointer">
                            <div className="flex items-center gap-3">
                                <Users size={20} className="text-[var(--color-text-muted)]" />
                                <span className="text-[14px]">
                                    {language === 'zh' ? '匿名投票' : 'Anonymous voting'}
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={isAnonymous}
                                onChange={(e) => setIsAnonymous(e.target.checked)}
                                className="w-5 h-5 rounded accent-[var(--color-primary)]"
                            />
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
