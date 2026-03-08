import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, MessageSquare, Bot, Settings, Rocket } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';

// Extract motion components so ESLint recognises the import as used
const MotionDiv = motion.div;

const STEPS = [
    { id: 'welcome', target: null, icon: Sparkles, titleKey: 'onboarding_welcome', descKey: 'onboarding_welcome_desc' },
    { id: 'chat', target: '[data-onboarding="chats"]', icon: MessageSquare, titleKey: 'onboarding_chat', descKey: 'onboarding_chat_desc' },
    { id: 'agents', target: '[data-onboarding="agents"]', icon: Bot, titleKey: 'onboarding_agents', descKey: 'onboarding_agents_desc' },
    { id: 'settings', target: '[data-onboarding="settings"]', icon: Settings, titleKey: 'onboarding_customize', descKey: 'onboarding_customize_desc' },
    { id: 'done', target: null, icon: Rocket, titleKey: 'onboarding_done', descKey: 'onboarding_done_desc' },
];

export default function OnboardingTutorial({ currentStep, totalSteps, nextStep, prevStep, skip, complete }) {
    const { t } = useLanguage();
    const [spotlightRect, setSpotlightRect] = useState(null);
    const step = STEPS[currentStep];
    const isFullscreen = !step.target;
    const isLast = currentStep === totalSteps - 1;
    const isFirst = currentStep === 0;
    const Icon = step.icon;

    const updateSpotlight = useCallback(() => {
        if (!step.target) {
            setSpotlightRect(null);
            return;
        }
        const el = document.querySelector(step.target);
        if (el) {
            const rect = el.getBoundingClientRect();
            setSpotlightRect({
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
            });
        }
    }, [step.target]);

    useEffect(() => {
        // Defer initial measurement to avoid synchronous setState in effect
        const raf = requestAnimationFrame(updateSpotlight);
        window.addEventListener('resize', updateSpotlight);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', updateSpotlight);
        };
    }, [updateSpotlight]);

    return (
        <div className="fixed inset-0 z-[9999]">
            {/* Overlay */}
            <div
                className="absolute inset-0 transition-all duration-500"
                style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    ...(spotlightRect && !isFullscreen ? {
                        clipPath: `polygon(
                            0% 0%, 100% 0%, 100% 100%, 0% 100%,
                            0% ${spotlightRect.top}px,
                            ${spotlightRect.left}px ${spotlightRect.top}px,
                            ${spotlightRect.left}px ${spotlightRect.top + spotlightRect.height}px,
                            ${spotlightRect.left + spotlightRect.width}px ${spotlightRect.top + spotlightRect.height}px,
                            ${spotlightRect.left + spotlightRect.width}px ${spotlightRect.top}px,
                            0% ${spotlightRect.top}px
                        )`,
                    } : {}),
                }}
                onClick={skip}
            />

            {/* Spotlight ring */}
            {spotlightRect && !isFullscreen && (
                <div
                    className="absolute rounded-[22px] ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-transparent pointer-events-none animate-pulse"
                    style={{
                        top: spotlightRect.top,
                        left: spotlightRect.left,
                        width: spotlightRect.width,
                        height: spotlightRect.height,
                    }}
                />
            )}

            {/* Content card */}
            <AnimatePresence mode="wait">
                <MotionDiv
                    key={step.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                        "absolute glass-crystal rounded-[var(--radius-2xl)] shadow-floating p-8 max-w-sm",
                        "border border-[var(--color-border-light)]",
                        isFullscreen
                            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
                            : "text-left"
                    )}
                    style={!isFullscreen && spotlightRect ? {
                        top: spotlightRect.top + spotlightRect.height / 2,
                        left: spotlightRect.left + spotlightRect.width + 24,
                        transform: 'translateY(-50%)',
                    } : undefined}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Icon */}
                    <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center mb-5",
                        "text-white shadow-lg",
                        isFullscreen ? "mx-auto" : ""
                    )} style={{ background: 'var(--gradient-aurora)' }}>
                        <Icon size={28} />
                    </div>

                    <h2 className="text-xl font-bold text-[var(--color-text-main)] mb-2">
                        {t(step.titleKey)}
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
                        {t(step.descKey)}
                    </p>

                    {/* Progress dots */}
                    <div className={cn("flex items-center gap-1.5 mb-5", isFullscreen ? "justify-center" : "")}>
                        {Array.from({ length: totalSteps }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-300",
                                    i === currentStep
                                        ? "w-6 bg-[var(--color-primary)]"
                                        : i < currentStep
                                            ? "w-1.5 bg-[var(--color-primary)]/50"
                                            : "w-1.5 bg-[var(--color-border)]"
                                )}
                            />
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-3">
                        {!isFirst && !isLast && (
                            <button
                                onClick={prevStep}
                                className="px-4 py-2 rounded-xl text-sm font-medium
                                    text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
                            >
                                {t('onboarding_back')}
                            </button>
                        )}
                        {!isLast && (
                            <button
                                onClick={skip}
                                className="px-4 py-2 rounded-xl text-sm font-medium
                                    text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
                            >
                                {t('onboarding_skip')}
                            </button>
                        )}
                        <button
                            onClick={isLast ? complete : nextStep}
                            className="ml-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                                shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                            style={{ background: 'var(--gradient-aurora)' }}
                        >
                            {isLast ? t('onboarding_get_started') : t('onboarding_next')}
                        </button>
                    </div>
                </MotionDiv>
            </AnimatePresence>
        </div>
    );
}
