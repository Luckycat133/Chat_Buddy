import React, { useState, Suspense } from 'react'; // Added Suspense
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useBackground } from '../features/background/BackgroundContext'; // New import
import { useSocial } from '../context/SocialContext';
import { ChevronRight, Bell, Lock, Globe, Info, Moon, HelpCircle, Volume2, VolumeX, BellOff, Trophy, Calendar, Gift, Search, Image } from 'lucide-react';
import { cn } from '../utils/cn';
import CheckInPanel from '../components/CheckInPanel';
import MessageSearchPanel from '../features/chat/components/MessageSearchPanel';

// Lazy load the modal
const BackgroundSettingsModal = React.lazy(() => import('../features/background/BackgroundSettingsModal'));

export default function Settings() {
    const { language, toggleLanguage, t } = useLanguage();
    const { userProfile, getDisplayName } = useUser();
    const { settings, toggleSound, toggleDoNotDisturb, toggleBrowserPush } = useNotification();
    const { isDarkMode, toggleDarkMode, theme } = useTheme(); // Removed chatBackgrounds, setChatBackground
    const { globalTheme } = useBackground(); // New hook
    const { points, streakDays, hasCheckedInToday } = useSocial();
    const navigate = useNavigate();

    const [showCheckIn, setShowCheckIn] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showBackgroundModal, setShowBackgroundModal] = useState(false); // New state

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto pb-16 md:pb-0">
            {/* ... Profile Card ... */}
            <div
                className="mx-4 mt-4 mb-4 p-5 rounded-2xl flex items-center gap-4 cursor-pointer 
                    shadow-md hover:shadow-lg transition-all duration-300 group relative overflow-hidden"
                style={{ background: 'var(--gradient-aurora-soft)' }}
                onClick={() => navigate('/profile')}
            >
                {/* ... same profile content ... */}
                {/* Aurora decoration */}
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-30 blur-2xl"
                    style={{ background: 'var(--gradient-aurora)' }} />
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold
                    shadow-md group-hover:scale-105 transition-transform duration-300 relative z-10">
                    {userProfile.avatar ? (
                        <img
                            src={userProfile.avatar}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-[var(--color-primary)] flex items-center justify-center">
                            {getDisplayName(language).charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="flex-1 relative z-10">
                    <h3 className="font-bold text-[var(--color-text-main)] text-lg font-display group-hover:text-[var(--color-primary)] transition-colors">
                        {getDisplayName(language)}
                    </h3>
                    <p className="text-[var(--color-text-muted)] text-[14px] mt-0.5">
                        {userProfile.signature || `ID: ${userProfile.id}`}
                    </p>
                </div>
                <ChevronRight size={20} className="text-[var(--color-text-muted)] relative z-10
                    group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all" />
            </div>

            {/* Social Features */}
            <div className="bg-[var(--color-bg-white)] mx-4 mb-3 rounded-2xl shadow-sm overflow-hidden border border-[var(--color-border)]">
                <SettingItem
                    icon={<Calendar size={22} />}
                    iconBg="bg-[#FF9800]"
                    label={language === 'zh' ? '每日签到' : 'Daily Check-in'}
                    value={hasCheckedInToday() ? (language === 'zh' ? '已签到' : 'Done') : `🔥 ${streakDays}`}
                    onClick={() => setShowCheckIn(true)}
                />
                <SettingItem
                    icon={<Trophy size={22} />}
                    iconBg="bg-[#FFD700]"
                    label={language === 'zh' ? '成就系统' : 'Achievements'}
                    value={`${points} ${language === 'zh' ? '积分' : 'pts'}`}
                    onClick={() => navigate('/achievements')}
                />
                <SettingItem
                    icon={<Search size={22} />}
                    iconBg="bg-[#607D8B]"
                    label={language === 'zh' ? '搜索聊天记录' : 'Search Messages'}
                    onClick={() => setShowSearch(true)}
                />
            </div>

            {/* Notification Settings */}
            <div className="bg-[var(--color-bg-white)] mx-4 mb-3 rounded-2xl shadow-sm overflow-hidden border border-[var(--color-border)]">
                <SettingItem
                    icon={settings.soundEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
                    iconBg="bg-[#4CAF50]"
                    label={language === 'zh' ? '消息提示音' : 'Notification Sound'}
                    toggle
                    toggleValue={settings.soundEnabled}
                    onToggle={toggleSound}
                />
                <SettingItem
                    icon={<BellOff size={22} />}
                    iconBg="bg-[#F44336]"
                    label={language === 'zh' ? '免打扰模式' : 'Do Not Disturb'}
                    toggle
                    toggleValue={settings.doNotDisturb}
                    onToggle={toggleDoNotDisturb}
                />
                <SettingItem
                    icon={<Bell size={22} />}
                    iconBg="bg-[#9C27B0]"
                    label={language === 'zh' ? '浏览器推送' : 'Browser Notifications'}
                    toggle
                    toggleValue={settings.browserPush}
                    onToggle={toggleBrowserPush}
                />
            </div>

            {/* Theme Settings */}
            <div className="bg-[var(--color-bg-white)] mx-4 mb-3 rounded-2xl shadow-sm overflow-hidden border border-[var(--color-border)]">
                <SettingItem
                    icon={<Moon size={22} />}
                    iconBg="bg-[#3F51B5]"
                    label={language === 'zh' ? '深色模式' : 'Dark Mode'}
                    toggle
                    toggleValue={isDarkMode}
                    onToggle={toggleDarkMode}
                />
                <SettingItem
                    icon={<Image size={22} />}
                    iconBg="bg-[#00BCD4]"
                    label={language === 'zh' ? '聊天背景' : 'Chat Background'}
                    value={language === 'zh' ? '点击配置' : 'Configure'}
                    onClick={() => setShowBackgroundModal(true)}
                />
            </div>

            {/* Modals */}
            {showCheckIn && <CheckInPanel onClose={() => setShowCheckIn(false)} />}
            {showSearch && <MessageSearchPanel onClose={() => setShowSearch(false)} />}

            {showBackgroundModal && (
                <Suspense fallback={null}>
                    <BackgroundSettingsModal
                        isOpen={true}
                        onClose={() => setShowBackgroundModal(false)}
                    // No chatId means Global Mode
                    />
                </Suspense>
            )}
            {/* Language & General */}
            <div className="bg-[var(--color-bg-white)] mx-4 mb-3 rounded-2xl shadow-sm overflow-hidden border border-[var(--color-border)]">
                <SettingItem
                    icon={<Globe size={22} />}
                    iconBg="bg-[#2196F3]"
                    label={t('interface_language')}
                    value={language === 'en' ? 'English' : '简体中文'}
                    onClick={toggleLanguage}
                />
                <SettingItem icon={<Lock size={22} />} iconBg="bg-[#4CAF50]" label={t('privacy') || 'Privacy'} />
            </div>

            {/* Help & About */}
            <div className="bg-[var(--color-bg-white)] mx-4 mt-3 mb-3 rounded-2xl shadow-sm overflow-hidden border border-[var(--color-border)]">
                <SettingItem
                    icon={<HelpCircle size={22} />}
                    iconBg="bg-[#2196F3]"
                    label={t('help')}
                    onClick={() => navigate('/help')}
                />
                <SettingItem
                    icon={<Info size={22} />}
                    iconBg="bg-[#2196F3]"
                    label={t('about')}
                    value="v0.2.3"
                    onClick={() => navigate('/about')}
                />
            </div>
        </div>
    );
}

function SettingItem({ icon, iconBg, label, value, onClick, toggle, toggleValue, onToggle }) {
    return (
        <div
            className="flex items-center px-4 py-3 border-b border-[var(--color-border-light)] last:border-b-0 active:bg-[#ECECEC] cursor-pointer"
            onClick={toggle ? onToggle : onClick}
        >
            <div className={cn("w-8 h-8 rounded-[6px] flex items-center justify-center text-white mr-3", iconBg)}>
                {icon}
            </div>
            <span className="flex-1 text-[16px] text-[var(--color-text-main)]">{label}</span>
            {toggle ? (
                <div className={cn(
                    "w-12 h-7 rounded-full transition-all relative",
                    toggleValue ? "bg-[var(--color-primary)]" : "bg-gray-300"
                )}>
                    <div className={cn(
                        "absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all",
                        toggleValue ? "left-5.5" : "left-0.5"
                    )} style={{ left: toggleValue ? '22px' : '2px' }} />
                </div>
            ) : (
                <>
                    {value && <span className="text-[var(--color-text-muted)] text-[15px] mr-1">{value}</span>}
                    <ChevronRight size={20} className="text-[#C7C7CC]" />
                </>
            )}
        </div>
    );
}
