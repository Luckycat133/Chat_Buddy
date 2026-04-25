import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ChevronDown, ChevronUp, MessageCircle, Users, Settings, Sparkles, HelpCircle } from 'lucide-react';
import { cn } from '../utils/cn';

export default function Help() {
    const { t } = useLanguage();
    const [expandedFaq, setExpandedFaq] = useState(null);

    const faqs = [
        {
            id: 1,
            icon: <MessageCircle size={20} />,
            question: t('faq_q1'),
            answer: t('faq_a1')
        },
        {
            id: 2,
            icon: <Users size={20} />,
            question: t('faq_q2'),
            answer: t('faq_a2')
        },
        {
            id: 3,
            icon: <Sparkles size={20} />,
            question: t('faq_q3'),
            answer: t('faq_a3')
        },
        {
            id: 4,
            icon: <Settings size={20} />,
            question: t('faq_q4'),
            answer: t('faq_a4')
        },
        {
            id: 5,
            icon: <HelpCircle size={20} />,
            question: t('faq_q5'),
            answer: t('faq_a5')
        }
    ];

    const toggleFaq = (id) => {
        setExpandedFaq(expandedFaq === id ? null : id);
    };

    return (
        <div className="page-container custom-scrollbar">
            {/* Ambient Background Glow */}
            <div className="page-ambient-glow" />

            <div className="page-content space-y-6">
                {/* Header */}
                <div className="page-header animate-fade-slide-down">
                    <div className="page-header-icon">
                        <HelpCircle size={24} />
                    </div>
                    <div>
                        <h1 className="page-header-title">
                            {t('help_title')}
                        </h1>
                        <p className="page-header-desc">
                            {t('help_subtitle')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Quick Tips */}
                    <aside className="card p-6 h-fit animate-fade-slide-up" style={{ animationDelay: '100ms' }}>
                        <h2 className="text-lg font-bold text-[var(--color-text-main)] mb-5 flex items-center gap-2">
                            <Sparkles size={20} className="text-[var(--color-accent-gold)]" />
                            {t('quick_tips')}
                        </h2>
                        <div className="space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-[var(--color-primary-light)] rounded-xl flex items-center justify-center text-[var(--color-primary)] flex-shrink-0 shadow-sm">
                                    <MessageCircle size={20} />
                                </div>
                                <p className="text-sm font-medium text-[var(--color-text-secondary)] leading-snug">
                                    {t('tip_1')}
                                </p>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-[var(--color-accent-blue-glow)] rounded-xl flex items-center justify-center text-[var(--color-accent-sky)] flex-shrink-0 shadow-sm">
                                    <Users size={20} />
                                </div>
                                <p className="text-sm font-medium text-[var(--color-text-secondary)] leading-snug">
                                    {t('tip_2')}
                                </p>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-[var(--color-primary-light)] rounded-xl flex items-center justify-center text-[var(--color-accent-gold)] flex-shrink-0 shadow-sm">
                                    <Sparkles size={20} />
                                </div>
                                <p className="text-sm font-medium text-[var(--color-text-secondary)] leading-snug">
                                    {t('tip_3')}
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-[var(--color-border-light)]">
                            <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2">
                                {t('need_more_help')}
                            </h3>
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                {t('contact_info')}
                            </p>
                            <a
                                href="https://github.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm w-full mt-4 inline-flex items-center justify-center gap-2 no-underline"
                            >
                                {t('contact_support')}
                            </a>
                        </div>
                    </aside>

                    {/* FAQ Section */}
                    <main className="lg:col-span-2 space-y-4 animate-fade-slide-up" style={{ animationDelay: '200ms' }}>
                        <div className="flex items-center justify-between mb-2 px-2">
                            <h2 className="text-lg font-bold text-[var(--color-text-main)]">
                                {t('faq_title')}
                            </h2>
                            <span className="badge">
                                {faqs.length} {t('questions') || 'Items'}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {faqs.map((faq) => {
                                const isExpanded = expandedFaq === faq.id;
                                return (
                                    <div
                                        key={faq.id}
                                        className={cn(
                                            "card overflow-hidden transition-all duration-300",
                                            isExpanded ? "ring-2 ring-[var(--color-primary)]/20 shadow-lg" : "hover:border-[var(--color-primary)]/30"
                                        )}
                                    >
                                        <button
                                            className={cn(
                                                "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors",
                                                isExpanded ? "bg-[var(--color-primary-light)]/30" : "bg-[var(--color-bg-white)]"
                                            )}
                                            onClick={() => toggleFaq(faq.id)}
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                                isExpanded ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-bg-hover)] text-[var(--color-primary)]"
                                            )}>
                                                {faq.icon}
                                            </div>
                                            <span className="flex-1 text-base font-semibold text-[var(--color-text-main)]">
                                                {faq.question}
                                            </span>
                                            {isExpanded ? (
                                                <ChevronUp size={20} className="text-[var(--color-primary)]" />
                                            ) : (
                                                <ChevronDown size={20} className="text-[var(--color-text-light)]" />
                                            )}
                                        </button>
                                        <div className={cn(
                                            "grid transition-all duration-300 ease-in-out",
                                            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                        )}>
                                            <div className="overflow-hidden">
                                                <div className="px-6 py-5 bg-[var(--color-bg-white)] border-t border-[var(--color-border-light)]">
                                                    <p className="text-[var(--color-text-secondary)] leading-relaxed">
                                                        {faq.answer}
                                                    </p>
                                                    <div className="mt-4 flex gap-2">
                                                        <button className="btn btn-ghost btn-sm">
                                                            {t('helpful')}
                                                        </button>
                                                        <button className="btn btn-ghost btn-sm">
                                                            {t('share')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
