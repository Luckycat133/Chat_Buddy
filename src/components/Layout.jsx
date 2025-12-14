import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { MessageSquare, Users, Settings, Plus } from 'lucide-react';
import { cn } from '../utils/cn';
import { useLanguage } from '../context/LanguageContext';

export default function Layout() {
    const { t } = useLanguage();

    return (
        <div className="flex h-screen bg-[var(--color-bg-app)] text-[var(--color-text-main)] overflow-hidden">
            {/* Sidebar - Desktop (WeChat style with macaron orange) */}
            <aside className="hidden md:flex w-16 flex-col items-center py-3 bg-[#3D3333]">
                {/* Logo */}
                <div className="mb-4">
                    <div className="w-10 h-10 rounded-[4px] overflow-hidden logo-animated">
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

                <nav className="flex-1 flex flex-col items-center gap-1">
                    <NavItem to="/" icon={<MessageSquare size={22} />} label={t('nav_chats')} />
                    <NavItem to="/groups" icon={<Users size={22} />} label={t('nav_groups')} />
                    <NavItem to="/create" icon={<Plus size={22} />} label="+" />
                </nav>

                <div className="mt-auto pb-2">
                    <NavItem to="/settings" icon={<Settings size={22} />} label={t('nav_settings')} />
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                <Outlet />
            </div>

            {/* Mobile Bottom Tab Bar (WeChat style) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#F7F7F7] border-t border-[#D9D9D9] flex justify-around items-center px-2 py-1 z-50">
                <MobileNavItem to="/" icon={<MessageSquare size={24} />} label={t('nav_chats')} />
                <MobileNavItem to="/groups" icon={<Users size={24} />} label={t('nav_groups')} />
                <MobileNavItem to="/create" icon={<Plus size={24} />} label="+" />
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
                "flex flex-col items-center justify-center w-12 h-12 rounded transition-all duration-200",
                isActive
                    ? "text-[var(--color-primary)]"
                    : "text-[#979797] hover:text-[#FFFFFF] hover:scale-105"
            )}
        >
            {icon}
        </NavLink>
    );
}

function MobileNavItem({ to, icon, label }) {
    return (
        <NavLink to={to} className={({ isActive }) => cn(
            "flex flex-col items-center py-1 px-4 transition-all duration-200",
            isActive ? "text-[var(--color-primary)]" : "text-[#999999]"
        )}>
            {icon}
            <span className="text-[10px] mt-0.5">{label}</span>
        </NavLink>
    )
}
