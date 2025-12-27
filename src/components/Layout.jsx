import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { MessageSquare, Users, Settings, Camera, UserCircle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useLanguage } from '../context/LanguageContext';

export default function Layout() {
    const { t } = useLanguage();

    return (
        <div className="flex h-screen bg-[var(--color-bg-app)] text-[var(--color-text-main)] overflow-hidden font-sans">
            {/* Sidebar - Desktop */}
            <aside className="hidden md:flex w-[72px] flex-col items-center py-6 bg-[#2E2E2E] shadow-xl z-20">
                {/* Logo */}
                <div className="mb-8">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shadow-glow logo-animated ring-2 ring-white/10">
                        <img
                            src="/logo.png"
                            alt="Chat Buddy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div class="w-full h-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm">CB</div>';
                            }}
                        />
                    </div>
                </div>

                <nav className="flex-1 flex flex-col items-center gap-4 w-full px-3">
                    <NavItem to="/" icon={<MessageSquare size={24} />} label={t('nav_chats')} />
                    <NavItem to="/friends" icon={<UserCircle size={24} />} label={t('friends')} />
                    <NavItem to="/moments" icon={<Camera size={24} />} label={t('moments')} />
                </nav>

                <div className="mt-auto pb-4 w-full px-3">
                    <NavItem to="/settings" icon={<Settings size={24} />} label={t('nav_settings')} />
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden relative">
                <Outlet />
            </div>

            {/* Mobile Bottom Tab Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-[var(--color-border)] flex justify-around items-center px-2 py-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-safe">
                <MobileNavItem to="/" icon={<MessageSquare size={24} />} label={t('nav_chats')} />
                <MobileNavItem to="/friends" icon={<UserCircle size={24} />} label={t('friends') || 'Friends'} />
                <MobileNavItem to="/moments" icon={<Camera size={24} />} label={t('moments') || 'Moments'} />
                <MobileNavItem to="/settings" icon={<Settings size={24} />} label={t('nav_settings')} />
            </nav>
        </div>
    );
}

function NavItem({ to, icon, label }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => cn(
                "group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300",
                isActive
                    ? "text-[var(--color-primary)] bg-white/10 shadow-inner"
                    : "text-[#979797] hover:text-white hover:bg-white/5 hover:scale-105"
            )}
            title={label}
        >
            {icon}
            {/* Tooltip for desktop could go here if needed */}
        </NavLink>
    );
}

function MobileNavItem({ to, icon, label }) {
    return (
        <NavLink to={to} className={({ isActive }) => cn(
            "flex flex-col items-center py-1 px-4 transition-all duration-300 rounded-lg",
            isActive
                ? "text-[var(--color-primary)] scale-105"
                : "text-[var(--color-text-muted)] active:scale-95"
        )}>
            {icon}
            <span className="text-[10px] mt-1 font-medium">{label}</span>
        </NavLink>
    )
}
