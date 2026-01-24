import React, { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useBackground } from '../features/background/BackgroundContext';
import { useSocial } from '../context/SocialContext';
import {
    ChevronRight, Bell, Lock, Globe, Info, Moon, HelpCircle,
    Volume2, VolumeX, BellOff, Trophy, Calendar, Search, Image,
    Settings as SettingsIcon, Shield, Laptop, LogOut
} from 'lucide-react';
import { cn } from '../utils/cn';
import CheckInPanel from '../components/CheckInPanel';
import MessageSearchPanel from '../features/chat/components/MessageSearchPanel';

const BackgroundSettingsModal = React.lazy(() => import('../features/background/BackgroundSettingsModal'));

export default function Settings() {
    const { language, toggleLanguage, t } = useLanguage();
    const { userProfile, getDisplayName } = useUser();
    const { settings, toggleSound, toggleDoNotDisturb, toggleBrowserPush } = useNotification();
    const { isDarkMode, toggleDarkMode } = useTheme();
    const { points, streakDays, hasCheckedInToday } = useSocial();
    const navigate = useNavigate();

    const [showCheckIn, setShowCheckIn] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showBackgroundModal, setShowBackgroundModal] = useState(false);

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto custom-scrollbar relative">
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none opacity-20"
                style={{
                    background: 'radial-gradient(circle at 10% 20%, var(--color-primary-glow) 0%, transparent 40%), radial-gradient(circle at 90% 80%, var(--color-accent-blue-glow) 0%, transparent 40%)'
                }}
            />

            <div className="max-w-5xl mx-auto px-6 py-8 relative z-10 space-y-8 pb-24">
                {/* Header */}
                <div className="flex items-center gap-3 animate-fade-slide-down">
                    <div className="p-3 bg-[var(--color-bg-white)] rounded-2xl shadow-sm border border-[var(--color-border)]">
                        <SettingsIcon size={24} className="text-[var(--color-primary)]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-[var(--color-text-main)]">
                            {language === 'zh' ? '控制中心' : 'Control Center'}
                        </h1>
                        <p className="text-[var(--color-text-muted)] text-sm">
                            {language === 'zh' ? '管理你的 AI 伙伴和偏好设置' : 'Manage your AI companions and preferences'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Pilot House (Profile) */}
                    <div className="space-y-6">
                        <section className="animate-fade-slide-up" style={{ animationDelay: '100ms' }}>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    {language === 'zh' ? '驾驶舱' : 'Pilot House'}
                                </span>
                            </div>

                            <div
                                className="glass-crystal rounded-[var(--radius-2xl)] p-6 shadow-floating relative overflow-hidden group cursor-pointer transition-all hover:scale-[1.02]"
                                onClick={() => navigate('/profile')}
                            >
                                {/* Active Status Ring Animation */}
                                <div className="absolute top-4 right-4 w-3 h-3 bg-[var(--color-success)] rounded-full shadow-[0_0_10px_var(--color-success)] animate-pulse" />

                                <div className="flex flex-col items-center text-center">
                                    <div className="w-24 h-24 rounded-[var(--radius-xl)] bg-[var(--color-bg-active)] mb-4 relative shadow-lg group-hover:shadow-glow transition-all">
                                        {userProfile.avatar ? (
                                            <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover rounded-[var(--radius-xl)]" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-3xl font-display font-bold text-[var(--color-primary)]">
                                                {getDisplayName(language).charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[var(--radius-xl)]" />
                                    </div>

                                    <h2 className="text-xl font-bold text-[var(--color-text-main)] mb-1">
                                        {getDisplayName(language)}
                                    </h2>
                                    <p className="text-sm text-[var(--color-text-muted)] bg-[var(--color-bg-white)] px-3 py-1 rounded-full border border-[var(--color-border)] mb-4">
                                        ID: {userProfile.id}
                                    </p>

                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        <div className="bg-[var(--color-bg-white)]/50 p-3 rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-bg-white)] transition-colors"
                                            onClick={(e) => { e.stopPropagation(); setShowCheckIn(true); }}>
                                            <div className="text-xs text-[var(--color-text-muted)] mb-1">{language === 'zh' ? '连续签到' : 'Streak'}</div>
                                            <div className="font-display font-bold text-lg text-[#FF9800] flex items-center justify-center gap-1">
                                                <Calendar size={14} />
                                                {streakDays}
                                            </div>
                                        </div>
                                        <div className="bg-[var(--color-bg-white)]/50 p-3 rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-bg-white)] transition-colors"
                                            onClick={(e) => { e.stopPropagation(); navigate('/achievements'); }}>
                                            <div className="text-xs text-[var(--color-text-muted)] mb-1">{language === 'zh' ? '积分' : 'Points'}</div>
                                            <div className="font-display font-bold text-lg text-[#FFD700] flex items-center justify-center gap-1">
                                                <Trophy size={14} />
                                                {points}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="animate-fade-slide-up" style={{ animationDelay: '200ms' }}>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    {language === 'zh' ? '通用' : 'General'}
                                </span>
                            </div>
                            <div className="bg-[var(--color-bg-white)] border border-[var(--color-border)] rounded-[var(--radius-xl)] overflow-hidden shadow-sm">
                                <SettingItem
                                    icon={<Globe size={18} />}
                                    color="bg-[#2196F3]"
                                    label={t('interface_language')}
                                    rightContent={
                                        <span className="font-medium text-[var(--color-text-main)] bg-[var(--color-bg-app)] px-3 py-1 rounded-lg text-sm border border-[var(--color-border-light)]">
                                            {language === 'en' ? 'English' : '简体中文'}
                                        </span>
                                    }
                                    onClick={toggleLanguage}
                                />
                                <SettingItem
                                    icon={<Lock size={18} />}
                                    color="bg-[#4CAF50]"
                                    label={t('privacy') || 'Privacy & Security'}
                                    onClick={() => { }}
                                />
                                <SettingItem
                                    icon={<HelpCircle size={18} />}
                                    color="bg-[#9C27B0]"
                                    label={t('help') || 'Help Center'}
                                    onClick={() => navigate('/help')}
                                />
                                <SettingItem
                                    icon={<LogOut size={18} />}
                                    color="bg-[var(--color-danger)]"
                                    label={t('logout') || 'Log Out'}
                                    className="text-[var(--color-danger)]"
                                    onClick={() => { }} // Handle logout
                                />
                            </div>
                        </section>
                    </div>

                    {/* Right Column: System Controls */}
                    <div className="lg:col-span-2 space-y-6">
                        <section className="animate-fade-slide-up" style={{ animationDelay: '150ms' }}>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    {language === 'zh' ? '系统偏好' : 'System Preferences'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ControlCard
                                    icon={<Moon size={24} />}
                                    color="bg-[#3F51B5]"
                                    label={language === 'zh' ? '深色模式' : 'Dark Mode'}
                                    subLabel={isDarkMode ? 'On' : 'Off'}
                                    active={isDarkMode}
                                    onClick={toggleDarkMode}
                                />
                                <ControlCard
                                    icon={<Image size={24} />}
                                    color="bg-[#00BCD4]"
                                    label={language === 'zh' ? '个性化背景' : 'Backgrounds'}
                                    subLabel={language === 'zh' ? '自定义外观' : 'Customize Look'}
                                    active={true}
                                    onClick={() => setShowBackgroundModal(true)}
                                />
                                <ControlCard
                                    icon={settings.soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                                    color="bg-[#E91E63]"
                                    label={language === 'zh' ? '提示音' : 'Sound'}
                                    subLabel={settings.soundEnabled ? 'Enabled' : 'Muted'}
                                    active={settings.soundEnabled}
                                    onClick={toggleSound}
                                />
                                <ControlCard
                                    icon={<BellOff size={24} />}
                                    color="bg-[#607D8B]"
                                    label={language === 'zh' ? '免打扰' : 'Do Not Disturb'}
                                    subLabel={settings.doNotDisturb ? 'Active' : 'Off'}
                                    active={settings.doNotDisturb}
                                    onClick={toggleDoNotDisturb}
                                />
                            </div>
                        </section>

                        <section className="animate-fade-slide-up" style={{ animationDelay: '250ms' }}>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    {language === 'zh' ? '高级工具' : 'Advanced Tools'}
                                </span>
                            </div>
                            <div className="bg-[var(--color-bg-white)] border border-[var(--color-border)] rounded-[var(--radius-xl)] overflow-hidden shadow-sm">
                                <SettingItem
                                    icon={<Search size={18} />}
                                    color="bg-[#795548]"
                                    label={language === 'zh' ? '全局搜索' : 'Global Search'}
                                    subLabel={language === 'zh' ? '搜索所有聊天记录' : 'Search across all chats'}
                                    onClick={() => setShowSearch(true)}
                                />
                                <SettingItem
                                    icon={<Shield size={18} />}
                                    color="bg-[#607D8B]"
                                    label={language === 'zh' ? '数据导出' : 'Export Data'}
                                    subLabel={language === 'zh' ? '备份你的回忆' : 'Backup your memories'}
                                    onClick={() => { }}
                                />
                                <SettingItem
                                    icon={<Laptop size={18} />}
                                    color="bg-[#FF5722]"
                                    label={language === 'zh' ? '设备管理' : 'Device Management'}
                                    rightContent={<span className="text-xs font-bold text-[var(--color-text-muted)]">3 Active</span>}
                                    onClick={() => { }}
                                />
                            </div>
                        </section>

                        <section className="animate-fade-slide-up" style={{ animationDelay: '300ms' }}>
                            <div className="p-4 rounded-xl border border-[var(--color-border-light)] text-center">
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    Chat Buddy v0.2.3 • Built with ❤️ by Agent Coder
                                </p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showCheckIn && <CheckInPanel onClose={() => setShowCheckIn(false)} />}
            {showSearch && <MessageSearchPanel onClose={() => setShowSearch(false)} />}
            {showBackgroundModal && (
                <Suspense fallback={null}>
                    <BackgroundSettingsModal isOpen={true} onClose={() => setShowBackgroundModal(false)} />
                </Suspense>
            )}
        </div>
    );
}

// Sub-components

function ControlCard({ icon, color, label, subLabel, active, onClick }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "p-5 rounded-[var(--radius-xl)] border cursor-pointer transition-all duration-300 relative overflow-hidden group hover:scale-[1.02]",
                active
                    ? "bg-[var(--color-bg-white)] border-[var(--color-border-aurora)] shadow-md"
                    : "bg-[var(--color-bg-app)] border-transparent opacity-80 hover:opacity-100"
            )}
        >
            <div className="flex items-start justify-between mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm", color)}>
                    {icon}
                </div>
                <div className={cn(
                    "w-12 h-7 rounded-full transition-all relative",
                    active ? "bg-[var(--color-success)]" : "bg-[var(--color-border)]"
                )}>
                    <div className={cn(
                        "absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all",
                        active ? "left-6" : "left-1"
                    )} />
                </div>
            </div>
            <div>
                <h3 className="font-bold text-[var(--color-text-main)] text-lg">{label}</h3>
                <p className="text-sm text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">
                    {subLabel}
                </p>
            </div>
        </div>
    );
}

function SettingItem({ icon, color, label, subLabel, rightContent, onClick, className }) {
    return (
        <div
            onClick={onClick}
            className="flex items-center p-4 hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors border-b border-[var(--color-border-light)] last:border-0"
        >
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm mr-4", color)}>
                {icon}
            </div>
            <div className="flex-1">
                <h4 className={cn("font-bold text-[15px] text-[var(--color-text-main)]", className)}>{label}</h4>
                {subLabel && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subLabel}</p>}
            </div>
            {rightContent || <ChevronRight size={18} className="text-[var(--color-text-light)]" />}
        </div>
    );
}
