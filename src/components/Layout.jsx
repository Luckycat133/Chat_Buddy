import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, Users, Settings, Camera, Bot, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';
import { useLanguage } from '../context/LanguageContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { SHORTCUT_DEFINITIONS, formatShortcut } from '../config/shortcuts';
import { useOnboarding } from '../hooks/useOnboarding';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import OnboardingTutorial from './OnboardingTutorial';

const BackgroundLayer = React.lazy(() => import('../features/background/BackgroundLayer'));

export default function Layout() {
    const { t } = useLanguage();
    const location = useLocation();
    const navigate = useNavigate();
    const mainRef = useRef(null);
    const prevPathRef = useRef(location.pathname);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const onboarding = useOnboarding();

    useEffect(() => {
        if (prevPathRef.current !== location.pathname && mainRef.current) {
            const main = mainRef.current;
            main.classList.add('page-transitioning');

            const timer = setTimeout(() => {
                main.classList.remove('page-transitioning');
            }, 280);

            prevPathRef.current = location.pathname;

            return () => clearTimeout(timer);
        }
    }, [location]);

    // Keyboard shortcuts
    const shortcuts = useMemo(() => [
        ...SHORTCUT_DEFINITIONS.filter(s => s.route).map(s => ({
            key: s.key, ctrl: true, action: () => navigate(s.route),
        })),
        { key: '/', ctrl: true, action: () => setShowShortcuts(prev => !prev) },
        { key: 'Escape', ctrl: false, action: () => { if (showShortcuts) setShowShortcuts(false); else window.history.back(); } },
    ], [navigate, showShortcuts]);

    useKeyboardShortcuts(shortcuts);

    return (
        <div className="flex h-screen bg-[var(--color-bg-app)] text-[var(--color-text-main)] overflow-hidden font-sans relative">
            {/* Global Background Layer */}
            <Suspense fallback={null}>
                <BackgroundLayer />
            </Suspense>

            {/* Ambient Backlight (Aurora) for depth */}
            <div aria-hidden="true" className="absolute top-0 left-0 w-full h-[60vh] opacity-40 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 10% 10%, var(--color-primary-softer), transparent 70%)' }}></div>
            <div aria-hidden="true" className="absolute bottom-0 right-0 w-full h-[60vh] opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 90% 90%, var(--color-accent-lavender), transparent 70%)' }}></div>

            {/* Sidebar - Desktop - Floating Vertical Island */}
            <aside aria-label="Sidebar" className="hidden md:flex flex-col items-center py-6 my-4 ml-4 z-30 relative
                w-[88px] rounded-[var(--radius-xl)] glass-crystal shadow-floating
                transition-transform duration-500 ease-out hover:scale-[1.01]">

                {/* Logo with glow effect */}
                <div className="mb-8 relative group cursor-pointer">
                    <div className="absolute inset-0 rounded-[var(--radius-lg)] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                            background: 'var(--gradient-aurora)',
                            filter: 'blur(16px)',
                            transform: 'scale(1.1)'
                        }} />
                    <div className="relative w-14 h-14 rounded-[var(--radius-lg)] overflow-hidden shadow-lg 
                        transition-all duration-500 group-hover:scale-105
                        ring-2 ring-[var(--color-border)] group-hover:ring-[var(--color-primary)]/40">
                        <img
                            src="/logo.png"
                            alt="Chat Buddy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `
                                    <div class="w-full h-full flex items-center justify-center text-white font-bold text-xl animate-aurora"
                                        style="background: var(--gradient-aurora)">
                                        <span class="flex items-center gap-0.5 transform group-hover:rotate-12 transition-transform duration-500">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                <path d="M12 3l1.5 4.5H18l-3.5 2.5 1.5 4.5L12 12l-4 2.5 1.5-4.5L6 7.5h4.5L12 3z"/>
                                            </svg>
                                        </span>
                                    </div>`;
                            }}
                        />
                    </div>
                </div>

                <nav aria-label="Primary" className="flex-1 flex flex-col items-center gap-5 w-full px-3">
                    <NavItem to="/" icon={<MessageSquare size={24} />} label={t('nav_chats')} delay={0} shortcutHint={formatShortcut(SHORTCUT_DEFINITIONS[0])} data-onboarding="chats" />
                    <NavItem to="/agents" icon={<Bot size={24} />} label={t('nav_agents') || 'Agents'} delay={50} shortcutHint={formatShortcut(SHORTCUT_DEFINITIONS[1])} data-onboarding="agents" />
                    <NavItem to="/friends" icon={<Users size={24} />} label={t('friends')} delay={100} shortcutHint={formatShortcut(SHORTCUT_DEFINITIONS[2])} />
                    <NavItem to="/moments" icon={<Camera size={24} />} label={t('moments')} delay={150} shortcutHint={formatShortcut(SHORTCUT_DEFINITIONS[3])} />
                </nav>

                <div className="mt-auto pt-4 w-full px-3">
                    <NavItem to="/settings" icon={<Settings size={24} />} label={t('nav_settings')} delay={200} shortcutHint={formatShortcut(SHORTCUT_DEFINITIONS[4])} data-onboarding="settings" />
                </div>
            </aside>

            {/* Main Content - Floating Island */}
            <div className="flex flex-1 overflow-hidden relative p-4 pl-0">
                <main
                    ref={mainRef}
                    className={cn(
                        "w-full h-full flex flex-col relative rounded-[var(--radius-xl)] shadow-floating glass-crystal overflow-hidden",
                        "border border-[var(--color-border-light)]",
                        "transition-all duration-[280ms] ease-out"
                    )}
                >
                    {/* Background sheen for the main container */}
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[var(--color-bg-white)]/40 to-transparent pointer-events-none opacity-50"></div>

                    <Outlet key={location.pathname} />
                </main>
            </div>

            {/* Mobile Bottom Tab Bar - Floating Dock (Hidden in Chat and Agent Workspace) */}
            {!location.pathname.startsWith('/chat/') && !location.pathname.match(/^\/agents\/[^/]+$/) && (
                <nav aria-label="Mobile" className="md:hidden fixed bottom-6 left-6 right-6 glass-crystal rounded-[var(--radius-xl)] shadow-floating
                    flex justify-around items-center px-4 py-3 z-50 animate-fade-slide-up border border-white/50">

                    <MobileNavItem to="/" icon={<MessageSquare size={24} />} label={t('nav_chats')} />
                    <MobileNavItem to="/agents" icon={<Bot size={24} />} label={t('nav_agents') || 'Agents'} />
                    <MobileNavItem to="/friends" icon={<Users size={24} />} label={t('friends')} />
                    <MobileNavItem to="/moments" icon={<Camera size={24} />} label={t('moments')} />
                    <MobileNavItem to="/settings" icon={<Settings size={24} />} label={t('nav_settings')} />
                </nav>
            )}

            {/* Keyboard Shortcuts Modal */}
            {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}

            {/* Onboarding Tutorial */}
            {onboarding.shouldShow && (
                <OnboardingTutorial
                    currentStep={onboarding.currentStep}
                    totalSteps={onboarding.totalSteps}
                    nextStep={onboarding.nextStep}
                    prevStep={onboarding.prevStep}
                    skip={onboarding.skip}
                    complete={onboarding.complete}
                />
            )}
        </div>
    );
}

function NavItem({ to, icon, label, delay, shortcutHint, ...rest }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => cn(
                "group relative flex items-center justify-center w-14 h-14 rounded-[22px] transition-all duration-400 ease-out",
                isActive
                    ? "text-white shadow-glow-strong scale-110"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-hover)] hover:shadow-lg hover:scale-105"
            )}
            title={shortcutHint ? `${label} (${shortcutHint})` : label}
            style={{ animationDelay: `${delay}ms` }}
            {...rest}
        >
            {({ isActive }) => (
                <>
                    {/* Active background - Squircle with Gradient */}
                    {isActive && (
                        <div className="absolute inset-0 rounded-[22px] animate-aurora shadow-inner"
                            style={{ background: 'var(--gradient-aurora)', backgroundSize: '150% 150%' }} />
                    )}

                    {/* Icon */}
                    <span className={cn(
                        "relative z-10 transition-transform duration-300",
                        isActive ? "scale-105 drop-shadow-sm" : "group-hover:scale-110"
                    )}>
                        {icon}
                    </span>

                    {/* Floating Tooltip */}
                    <span className="absolute left-full ml-5 px-4 py-2 rounded-xl text-sm font-semibold
                        text-[var(--color-text-main)] opacity-0 group-hover:opacity-100 pointer-events-none
                        transition-all duration-300 translate-x-4 group-hover:translate-x-0
                        shadow-floating glass-strong whitespace-nowrap z-50 border border-[var(--color-border-light)]">
                        {label}
                    </span>
                </>
            )}
        </NavLink>
    );
}

function MobileNavItem({ to, icon, label }) {
    return (
        <NavLink to={to} className={({ isActive }) => cn(
            "flex-1 flex flex-col items-center py-2 px-1 transition-all duration-300 rounded-xl relative",
            isActive
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] active:scale-95"
        )}>
            {({ isActive }) => (
                <>
                    {/* Active indicator dot */}
                    {isActive && (
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full animate-scale-in"
                            style={{ background: 'var(--gradient-aurora)' }} />
                    )}
                    <div className={cn(
                        "transition-all duration-300 transform",
                        isActive ? "-translate-y-1 scale-115" : ""
                    )}>
                        {icon}
                    </div>
                    <span className={cn(
                        "text-[10px] mt-0.5 font-medium transition-opacity duration-200",
                        isActive ? "opacity-100" : "opacity-0"
                    )}>
                        {label}
                    </span>
                </>
            )}
        </NavLink>
    )
}
