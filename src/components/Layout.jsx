import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, Users, Settings, Camera, UserCircle, Bot } from 'lucide-react';
import { cn } from '../utils/cn';
import { useLanguage } from '../context/LanguageContext';

export default function Layout() {
    const { t } = useLanguage();
    const location = useLocation();
    const [pageTransition, setPageTransition] = useState(false);

    // Simple page transition effect
    useEffect(() => {
        setPageTransition(true);
        const timer = setTimeout(() => setPageTransition(false), 300);
        return () => clearTimeout(timer);
    }, [location.pathname]);

    return (
        <div className="flex h-screen bg-[var(--color-bg-app)] text-[var(--color-text-main)] overflow-hidden font-sans">
            {/* Sidebar - Desktop - Redesigned Light Theme */}
            <aside className="hidden md:flex w-[84px] flex-col items-center py-6 bg-white border-r border-[var(--color-border-light)] z-30 transition-all duration-300">
                {/* Logo */}
                <div className="mb-10 hover-lift cursor-pointer">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm hover:shadow-glow transition-shadow duration-300">
                        <img
                            src="/logo.png"
                            alt="Chat Buddy"
                            className="w-full h-full object-cover transform transition-transform duration-500 hover:scale-105"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div class="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm">CB</div>';
                            }}
                        />
                    </div>
                </div>

                <nav className="flex-1 flex flex-col items-center gap-4 w-full px-4">
                    <NavItem to="/" icon={<MessageSquare size={24} />} label={t('nav_chats')} delay={0} />
                    <NavItem to="/agents" icon={<Bot size={24} />} label={t('nav_agents') || 'Agents'} delay={50} />
                    <NavItem to="/friends" icon={<Users size={24} />} label={t('friends')} delay={100} />
                    <NavItem to="/moments" icon={<Camera size={24} />} label={t('moments')} delay={150} />
                </nav>

                <div className="mt-auto pb-6 w-full px-4">
                    <NavItem to="/settings" icon={<Settings size={24} />} label={t('nav_settings')} delay={200} />
                </div>
            </aside>

            {/* Main Content with Transition Wrapper */}
            <div className="flex flex-1 overflow-hidden relative bg-[var(--color-bg-app)]">
                <div className={cn(
                    "w-full h-full flex flex-col transition-opacity duration-300 ease-in-out",
                    pageTransition ? "opacity-95" : "opacity-100"
                )}>
                    <Outlet />
                </div>
            </div>

            {/* Mobile Bottom Tab Bar - Glassmorphism */}
            <nav className="md:hidden fixed bottom-6 left-4 right-4 bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl shadow-float flex justify-around items-center px-1 py-1 z-50 pb-safe animate-slide-up">
                <MobileNavItem to="/" icon={<MessageSquare size={24} />} label={t('nav_chats')} />
                <MobileNavItem to="/agents" icon={<Bot size={24} />} label={t('nav_agents') || 'Agents'} />
                <MobileNavItem to="/friends" icon={<Users size={24} />} label={t('friends')} />
                <MobileNavItem to="/moments" icon={<Camera size={24} />} label={t('moments')} />
                <MobileNavItem to="/settings" icon={<Settings size={24} />} label={t('nav_settings')} />
            </nav>
        </div>
    );
}

function NavItem({ to, icon, label, delay }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => cn(
                "group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300",
                isActive
                    ? "text-[var(--color-primary)] bg-[var(--color-primary-softer)] shadow-sm"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-hover)]"
            )}
            title={label}
            style={{ animationDelay: `${delay}ms` }}
        >
            {icon}
        </NavLink>
    );
}

function MobileNavItem({ to, icon }) {
    return (
        <NavLink to={to} className={({ isActive }) => cn(
            "flex-1 flex flex-col items-center py-2 px-1 transition-all duration-300 rounded-xl relative",
            isActive
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] active:scale-95"
        )}>
            {({ isActive }) => (
                <>
                    <div className={cn(
                        "transition-all duration-300 transform",
                        isActive ? "-translate-y-1 scale-110" : ""
                    )}>
                        {icon}
                    </div>
                </>
            )}
        </NavLink>
    )
}
