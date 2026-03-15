import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Info, Code, Heart, ExternalLink, FileText, Users } from 'lucide-react';

export default function About() {
    const { t } = useLanguage();
    const [logoError, setLogoError] = useState(false);

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
        <div className="page-container custom-scrollbar">
            {/* Ambient Background Glow */}
            <div className="page-ambient-glow" />

            <div className="page-content space-y-6">
                {/* App Info Header */}
                <div className="page-header animate-fade-slide-down">
                    <div className="page-header-icon logo-animated overflow-hidden !p-0">
                        {logoError ? (
                            <div className="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white text-xl font-bold">
                                CB
                            </div>
                        ) : (
                            <img
                                src="/logo.png"
                                alt="Chat Buddy"
                                className="w-full h-full object-cover"
                                onError={() => setLogoError(true)}
                            />
                        )}
                    </div>
                    <div>
                        <h1 className="page-header-title">
                            Chat Buddy
                        </h1>
                        <p className="page-header-desc">
                            v0.3.0 • {t('about_tagline')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Features */}
                    <section className="card p-6 animate-fade-slide-up" style={{ animationDelay: '100ms' }}>
                        <h2 className="text-lg font-bold text-[var(--color-text-main)] mb-4 flex items-center gap-2">
                            <Info size={20} className="text-[var(--color-primary)]" />
                            {t('about_features')}
                        </h2>
                        <div className="space-y-4">
                            {features.map((feature, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-app)]/50 border border-[var(--color-border-light)]">
                                    <span className="text-[var(--color-primary)]">{feature.icon}</span>
                                    <span className="text-sm font-medium text-[var(--color-text-main)]">{feature.text}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Tech Stack */}
                    <section className="card p-6 animate-fade-slide-up" style={{ animationDelay: '150ms' }}>
                        <h2 className="text-lg font-bold text-[var(--color-text-main)] mb-4 flex items-center gap-2">
                            <Code size={20} className="text-[var(--color-primary)]" />
                            {t('tech_stack')}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {['React 18', 'Vite', 'TailwindCSS', 'DeepSeek API', 'LocalStorage'].map((tech) => (
                                <span
                                    key={tech}
                                    className="badge badge-primary px-3 py-1.5"
                                >
                                    {tech}
                                </span>
                            ))}
                        </div>
                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                                {t('links')}
                            </h3>
                            <div className="space-y-3">
                                <a
                                    href="https://github.com/user/chat-buddy-remake"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline transition-all"
                                >
                                    <ExternalLink size={16} />
                                    GitHub Repository
                                </a>
                                <a
                                    href="https://github.com/user/chat-buddy-remake/blob/main/CHANGELOG.md"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all"
                                >
                                    <FileText size={16} />
                                    {t('full_changelog')}
                                </a>
                            </div>
                        </div>
                    </section>

                    {/* Changelog Summary */}
                    <section className="card p-6 md:col-span-2 animate-fade-slide-up" style={{ animationDelay: '200ms' }}>
                        <h2 className="text-lg font-bold text-[var(--color-text-main)] mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-[var(--color-primary)]" />
                            {t('changelog_title')}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {changelog.slice(0, 6).map((item, index) => (
                                <div key={index} className="p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-app)]/30">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="badge badge-primary">
                                            {item.version}
                                        </span>
                                        <span className="text-[10px] font-medium text-[var(--color-text-muted)]">
                                            {item.date}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">
                                        {item.changes}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <footer className="py-10 text-center animate-fade-in" style={{ animationDelay: '300ms' }}>
                    <p className="text-sm text-[var(--color-text-muted)] flex items-center justify-center gap-1">
                        Chat Buddy Remake <span className="text-[var(--color-danger)]">❤️</span>
                    </p>
                    <p className="text-xs text-[var(--color-text-light)] mt-1">
                        © 2026 Chat Buddy Remake Project
                    </p>
                </footer>
            </div>
        </div>
    );
}
