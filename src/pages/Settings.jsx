import React, { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useSocial } from '../context/SocialContext';
import {
    ChevronRight, Bell, Lock, Globe, Info, Moon, HelpCircle,
    Volume2, VolumeX, BellOff, Trophy, Calendar, Search, Image,
    Settings as SettingsIcon, Shield, Laptop, LogOut,
    Server, Download, Upload, Sparkles, MessageSquare
} from 'lucide-react';
import { cn } from '../utils/cn';
import CheckInPanel from '../components/CheckInPanel';
import MessageSearchPanel from '../features/chat/components/MessageSearchPanel';
import { exportAllData, importData } from '../config/apiConfig';

const BackgroundSettingsModal = React.lazy(() => import('../features/background/BackgroundSettingsModal'));
const ApiConfigPanel = React.lazy(() => import('../components/ApiConfigPanel'));

export default function Settings() {
    const { language, toggleLanguage, t } = useLanguage();
    const { userProfile, getDisplayName } = useUser();
    const { settings, toggleSound, toggleDoNotDisturb } = useNotification();
    const { isDarkMode, themeMode, toggleDarkMode, animationIntensity, setAnimationIntensity, bubbleStyle, setBubbleStyle } = useTheme();
    const { points, streakDays } = useSocial();
    const navigate = useNavigate();

    const [showCheckIn, setShowCheckIn] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showBackgroundModal, setShowBackgroundModal] = useState(false);
    const [showApiConfig, setShowApiConfig] = useState(false);
    const [importMsg, setImportMsg] = useState(null);
    const fileInputRef = React.useRef(null);

    const handleExport = () => {
        exportAllData();
    };

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const count = await importData(file);
            setImportMsg({ type: 'success', text: t('import_success', { count }) });
        } catch (err) {
            setImportMsg({ type: 'error', text: t('import_failed', { error: err.message }) });
        }
        e.target.value = '';
    };

    return (
        <div className="page-container custom-scrollbar">
            {/* Ambient Background Glow */}
            <div className="page-ambient-glow" />

            <div className="page-content space-y-8">
                {/* Header */}
                <div className="page-header animate-fade-slide-down">
                    <div className="page-header-icon">
                        <SettingsIcon size={24} />
                    </div>
                    <div>
                        <h1 className="page-header-title">
                            {t('settings_control_center')}
                        </h1>
                        <p className="page-header-desc">
                            {t('settings_control_center_desc')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Pilot House (Profile) */}
                    <div className="space-y-6">
                        <section className="animate-fade-slide-up" style={{ animationDelay: '100ms' }}>
                            <div className="section-title">
                                {t('settings_pilot_house')}
                            </div>

                            <div
                                className="glass-crystal profile-card rounded-[var(--radius-2xl)] p-6 shadow-floating"
                                onClick={() => navigate('/profile')}
                            >
                                {/* Active Status Ring Animation */}
                                <div className="absolute top-4 right-4 status-dot animate-pulse" />

                                <div className="flex flex-col items-center text-center">
                                    <div className="profile-avatar mb-4">
                                        {userProfile.avatar ? (
                                            <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover rounded-[var(--radius-xl)]" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-3xl font-display font-bold text-[var(--color-primary)]">
                                                {getDisplayName(language).charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="profile-avatar-ring" />
                                    </div>

                                    <h2 className="profile-name mb-1">
                                        {getDisplayName(language)}
                                    </h2>
                                    <p className="profile-id mb-4">
                                        ID: {userProfile.id}
                                    </p>

                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        <div className="stat-card"
                                            onClick={(e) => { e.stopPropagation(); setShowCheckIn(true); }}>
                                            <div className="stat-card-label">{t('streak_stat')}</div>
                                            <div className="stat-card-value" style={{ color: '#FF9800' }}>
                                                <Calendar size={14} />
                                                {streakDays}
                                            </div>
                                        </div>
                                        <div className="stat-card"
                                            onClick={(e) => { e.stopPropagation(); navigate('/achievements'); }}>
                                            <div className="stat-card-label">{t('total_points')}</div>
                                            <div className="stat-card-value" style={{ color: '#FFD700' }}>
                                                <Trophy size={14} />
                                                {points}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="animate-fade-slide-up" style={{ animationDelay: '200ms' }}>
                            <div className="section-title">
                                {t('preferences')}
                            </div>
                            <div className="settings-group">
                                <SettingItem
                                    icon={<Globe size={18} />}
                                    color="bg-[#2196F3]"
                                    label={t('interface_language')}
                                    rightContent={
                                        <span className="lang-badge">
                                            {t(language === 'en' ? 'lang_english' : 'lang_chinese')}
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
                                    labelClassName="text-[var(--color-danger)]"
                                    onClick={() => { }} // Handle logout
                                />
                            </div>
                        </section>
                    </div>

                    {/* Right Column: System Controls */}
                    <div className="lg:col-span-2 space-y-6">
                        <section className="animate-fade-slide-up" style={{ animationDelay: '150ms' }}>
                            <div className="section-title">
                                {t('appearance')}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ControlCard
                                    icon={<Moon size={24} />}
                                    color="bg-[#3F51B5]"
                                    label={t('theme_mode')}
                                    subLabel={t(`theme_${themeMode}`)}
                                    active={isDarkMode}
                                    onClick={toggleDarkMode}
                                />
                                <ControlCard
                                    icon={<Image size={24} />}
                                    color="bg-[#00BCD4]"
                                    label={t('backgrounds')}
                                    subLabel={t('customize_look')}
                                    active={true}
                                    onClick={() => setShowBackgroundModal(true)}
                                />
                                <ControlCard
                                    icon={<Sparkles size={24} />}
                                    color="bg-[#FF9800]"
                                    label={t('animation_intensity')}
                                    subLabel={t(`anim_${animationIntensity}`)}
                                    active={animationIntensity !== 'none'}
                                    onClick={() => {
                                        const cycle = ['none', 'subtle', 'standard', 'intense'];
                                        const idx = cycle.indexOf(animationIntensity);
                                        setAnimationIntensity(cycle[(idx + 1) % cycle.length]);
                                    }}
                                />
                                <ControlCard
                                    icon={<MessageSquare size={24} />}
                                    color="bg-[#9C27B0]"
                                    label={t('bubble_style')}
                                    subLabel={t(`bubble_${bubbleStyle}`)}
                                    active={true}
                                    onClick={() => {
                                        const cycle = ['rounded', 'square', 'tail', 'minimal'];
                                        const idx = cycle.indexOf(bubbleStyle);
                                        setBubbleStyle(cycle[(idx + 1) % cycle.length]);
                                    }}
                                />
                                <ControlCard
                                    icon={settings.soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                                    color="bg-[#E91E63]"
                                    label={t('sound')}
                                    subLabel={settings.soundEnabled ? t('sound_enabled') : t('sound_muted')}
                                    active={settings.soundEnabled}
                                    onClick={toggleSound}
                                />
                                <ControlCard
                                    icon={<BellOff size={24} />}
                                    color="bg-[#607D8B]"
                                    label={t('do_not_disturb')}
                                    subLabel={settings.doNotDisturb ? t('dnd_active') : t('dnd_off')}
                                    active={settings.doNotDisturb}
                                    onClick={toggleDoNotDisturb}
                                />
                            </div>
                        </section>

                        <section className="animate-fade-slide-up" style={{ animationDelay: '250ms' }}>
                            <div className="section-title">
                                {t('advanced_tools')}
                            </div>
                            <div className="settings-group">
                                <SettingItem
                                    icon={<Server size={18} />}
                                    color="bg-[#2196F3]"
                                    label={t('api_config')}
                                    subLabel={t('api_config_desc')}
                                    onClick={() => setShowApiConfig(true)}
                                />
                                <SettingItem
                                    icon={<Search size={18} />}
                                    color="bg-[#795548]"
                                    label={t('global_search')}
                                    subLabel={t('search_all_chats')}
                                    onClick={() => setShowSearch(true)}
                                />
                                <SettingItem
                                    icon={<Download size={18} />}
                                    color="bg-[#607D8B]"
                                    label={t('export_data_title')}
                                    subLabel={t('export_data_desc')}
                                    onClick={handleExport}
                                />
                                <SettingItem
                                    icon={<Upload size={18} />}
                                    color="bg-[#FF9800]"
                                    label={t('import_data')}
                                    subLabel={t('import_data_desc')}
                                    onClick={() => fileInputRef.current?.click()}
                                />
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleImport}
                                    className="hidden"
                                />
                            </div>
                            {importMsg && (
                                <div className={cn(
                                    "import-msg",
                                    importMsg.type === 'success' ? "import-msg-success" : "import-msg-error"
                                )}>
                                    <span>{importMsg.text}</span>
                                    {importMsg.type === 'success' && (
                                        <button
                                            onClick={() => window.location.reload()}
                                            className="btn-primary ml-2 px-3 py-1 text-xs"
                                        >
                                            {t('reload_now')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </section>

                        <section className="animate-fade-slide-up" style={{ animationDelay: '300ms' }}>
                            <div className="version-footer">
                                <p>
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
            {showApiConfig && (
                <Suspense fallback={null}>
                    <ApiConfigPanel onClose={() => setShowApiConfig(false)} />
                </Suspense>
            )}
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
            className={cn("control-card", active && "active")}
        >
            <div className="control-card-header">
                <div className={cn("control-card-icon", color)}>
                    {icon}
                </div>
                <div className={cn("toggle", active && "active")}>
                    <div className="toggle-thumb" />
                </div>
            </div>
            <div>
                <h3 className="control-card-label">{label}</h3>
                <p className="control-card-sublabel">
                    {subLabel}
                </p>
            </div>
        </div>
    );
}

function SettingItem({ icon, color, label, subLabel, rightContent, onClick, labelClassName }) {
    return (
        <div
            onClick={onClick}
            className="setting-item"
        >
            <div className={cn("setting-item-icon", color)}>
                {icon}
            </div>
            <div className="setting-item-content">
                <h4 className={cn("setting-item-label", labelClassName)}>{label}</h4>
                {subLabel && <p className="setting-item-sublabel">{subLabel}</p>}
            </div>
            {rightContent || <ChevronRight size={18} className="setting-item-chevron" />}
        </div>
    );
}
