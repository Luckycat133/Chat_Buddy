import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ChevronDown, ChevronUp, MessageCircle, Users, Settings, Sparkles, HelpCircle } from 'lucide-react';

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
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto pb-16 md:pb-0">
            {/* Header */}
            <div className="bg-white px-4 py-5 mb-2">
                <h1 className="text-xl font-semibold text-[var(--color-text-main)]">
                    {t('help_title')}
                </h1>
                <p className="text-[var(--color-text-muted)] text-sm mt-1">
                    {t('help_subtitle')}
                </p>
            </div>

            {/* Quick Tips */}
            <div className="bg-white px-4 py-4 mb-2">
                <h2 className="font-medium text-[var(--color-text-main)] mb-3">
                    {t('quick_tips')}
                </h2>
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-[var(--color-primary-light)] rounded-full flex items-center justify-center text-[var(--color-primary)]">
                            <MessageCircle size={16} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-main)]">{t('tip_1')}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-[var(--color-primary-light)] rounded-full flex items-center justify-center text-[var(--color-primary)]">
                            <Users size={16} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-main)]">{t('tip_2')}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-[var(--color-primary-light)] rounded-full flex items-center justify-center text-[var(--color-primary)]">
                            <Sparkles size={16} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--color-text-main)]">{t('tip_3')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="bg-white px-4 py-4 mb-2">
                <h2 className="font-medium text-[var(--color-text-main)] mb-3">
                    {t('faq_title')}
                </h2>
                <div className="space-y-2">
                    {faqs.map((faq) => (
                        <div
                            key={faq.id}
                            className="border border-[var(--color-border-light)] rounded-lg overflow-hidden"
                        >
                            <button
                                className="w-full flex items-center gap-3 px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors"
                                onClick={() => toggleFaq(faq.id)}
                            >
                                <span className="text-[var(--color-primary)]">{faq.icon}</span>
                                <span className="flex-1 text-sm font-medium text-[var(--color-text-main)]">
                                    {faq.question}
                                </span>
                                {expandedFaq === faq.id ? (
                                    <ChevronUp size={18} className="text-[var(--color-text-muted)]" />
                                ) : (
                                    <ChevronDown size={18} className="text-[var(--color-text-muted)]" />
                                )}
                            </button>
                            {expandedFaq === faq.id && (
                                <div className="px-4 py-3 bg-gray-50 border-t border-[var(--color-border-light)]">
                                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                        {faq.answer}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Contact Section */}
            <div className="bg-white px-4 py-4 mb-2">
                <h2 className="font-medium text-[var(--color-text-main)] mb-2">
                    {t('need_more_help')}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                    {t('contact_info')}
                </p>
            </div>
        </div>
    );
}
