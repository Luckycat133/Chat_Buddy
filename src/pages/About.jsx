import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Info, Code, Heart, ExternalLink, FileText, Users } from 'lucide-react';

export default function About() {
    const { t } = useLanguage();

    const features = [
        { icon: <Users size={18} />, text: t('feature_personas') },
        { icon: <Code size={18} />, text: t('feature_tech') },
        { icon: <Heart size={18} />, text: t('feature_anime') }
    ];

    const changelog = [
        { version: 'v0.3.0', date: '2026-01-08', changes: t('changelog_v030') },
        { version: 'v0.2.5', date: '2025-12-27', changes: t('changelog_v025') },
        { version: 'v0.2.4', date: '2025-12-21', changes: t('changelog_v024') },
        { version: 'v0.2.3', date: '2025-12-20', changes: t('changelog_v023') },
        { version: 'v0.2.2', date: '2025-12-14', changes: t('changelog_v022') },
        { version: 'v0.2.1', date: '2025-12-13', changes: t('changelog_v021') },
        { version: 'v0.2.0', date: '2025-12-07', changes: t('changelog_v020') },
        { version: 'v0.1.1', date: '2025-12-06', changes: t('changelog_v011') },
        { version: 'v0.1.0', date: '2025-12-05', changes: t('changelog_v010') }
    ];

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto pb-16 md:pb-0">
            {/* App Info Header */}
            <div className="bg-white px-4 py-6 mb-2 text-center">
                <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-3 shadow-lg logo-animated">
                    <img
                        src="/logo.png"
                        alt="Chat Buddy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white text-3xl font-bold">CB</div>';
                        }}
                    />
                </div>
                <h1 className="text-xl font-semibold text-[var(--color-text-main)]">
                    Chat Buddy
                </h1>
                <p className="text-[var(--color-primary)] font-medium mt-1">
                    v0.3.0
                </p>
                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                    {t('about_tagline')}
                </p>
            </div>

            {/* Features */}
            <div className="bg-white px-4 py-4 mb-2">
                <h2 className="font-medium text-[var(--color-text-main)] mb-3 flex items-center gap-2">
                    <Info size={18} className="text-[var(--color-primary)]" />
                    {t('about_features')}
                </h2>
                <div className="space-y-3">
                    {features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-3">
                            <span className="text-[var(--color-primary)]">{feature.icon}</span>
                            <span className="text-sm text-[var(--color-text-main)]">{feature.text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Changelog Summary */}
            <div className="bg-white px-4 py-4 mb-2">
                <h2 className="font-medium text-[var(--color-text-main)] mb-3 flex items-center gap-2">
                    <FileText size={18} className="text-[var(--color-primary)]" />
                    {t('changelog_title')}
                </h2>
                <div className="space-y-3">
                    {changelog.map((item, index) => (
                        <div key={index} className="border-l-2 border-[var(--color-primary)] pl-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[var(--color-primary)]">
                                    {item.version}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)]">
                                    {item.date}
                                </span>
                            </div>
                            <p className="text-sm text-[var(--color-text-muted)] mt-1">
                                {item.changes}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tech Stack */}
            <div className="bg-white px-4 py-4 mb-2">
                <h2 className="font-medium text-[var(--color-text-main)] mb-3 flex items-center gap-2">
                    <Code size={18} className="text-[var(--color-primary)]" />
                    {t('tech_stack')}
                </h2>
                <div className="flex flex-wrap gap-2">
                    {['React 18', 'Vite', 'TailwindCSS', 'DeepSeek API', 'LocalStorage'].map((tech) => (
                        <span
                            key={tech}
                            className="px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs rounded-full"
                        >
                            {tech}
                        </span>
                    ))}
                </div>
            </div>

            {/* Links */}
            <div className="bg-white px-4 py-4 mb-2">
                <h2 className="font-medium text-[var(--color-text-main)] mb-3">
                    {t('links')}
                </h2>
                <div className="space-y-2">
                    <a
                        href="https://github.com/user/chat-buddy-remake"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
                    >
                        <ExternalLink size={16} />
                        GitHub Repository
                    </a>
                    <a
                        href="https://github.com/user/chat-buddy-remake/blob/main/CHANGELOG.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
                    >
                        <FileText size={16} />
                        {t('full_changelog')}
                    </a>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-6 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                    {t('made_with_love')}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    © 2025 Chat Buddy Remake
                </p>
            </div>
        </div>
    );
}
