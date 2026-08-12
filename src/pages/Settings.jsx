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
    Server, Download, Upload, Sparkles, MessageSquare, RotateCcw, ClipboardList, Brain,
    Database, Cpu, Network, GraduationCap
} from 'lucide-react';
import { cn } from '../utils/cn';
import CheckInPanel from '../components/CheckInPanel';
import DailyTaskPanel from '../components/DailyTaskPanel';
import { useOnboarding } from '../hooks/useOnboarding';
import AccentColorPicker from '../components/AccentColorPicker';
import MessageSearchPanel from '../features/chat/components/MessageSearchPanel';
import { clearAllAppData, exportAllData, importData } from '../config/apiConfig';
import CharacterMemoryPanel from '../components/CharacterMemoryPanel';
import { INITIAL_PERSONAS } from '../data/personas';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { APP_VERSION } from '../utils/appVersion';

const BackgroundSettingsModal = React.lazy(() => import('../features/background/BackgroundSettingsModal'));
const ApiConfigPanel = React.lazy(() => import('../components/ApiConfigPanel'));
const KnowledgeBasePanel = React.lazy(() => import('../components/KnowledgeBasePanel'));
const ModelSwitcherPanel = React.lazy(() => import('../components/ModelSwitcherPanel'));
const KnowledgeGraphPanel = React.lazy(() => import('../components/KnowledgeGraphPanel'));
const LearningReportPanel = React.lazy(() => import('../components/LearningReportPanel'));

export default function Settings() {
    const { language, toggleLanguage, t } = useLanguage();
    const { userProfile, getDisplayName } = useUser();
    const { settings, toggleSound, toggleDoNotDisturb } = useNotification();
    const { isDarkMode, themeMode, toggleDarkMode, oledEnabled, toggleOLEDMode, animationIntensity, setAnimationIntensity, bubbleStyle, setBubbleStyle } = useTheme();
    const { points, streakDays, getDailyTaskProgress } = useSocial();
    const taskProgress = getDailyTaskProgress();
    const { reset: resetTutorial } = useOnboarding();
    const navigate = useNavigate();

    const [showCheckIn, setShowCheckIn] = useState(false);
    const [showDailyTasks, setShowDailyTasks] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showBackgroundModal, setShowBackgroundModal] = useState(false);
    const [showApiConfig, setShowApiConfig] = useState(false);
    const [importMsg, setImportMsg] = useState(null);
    const [memoryCharacter, setMemoryCharacter] = useState(null); // T12: Memory panel
    const [showMemorySelector, setShowMemorySelector] = useState(false);
    // T14/T15 panels
    const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
    const [showModelSwitcher, setShowModelSwitcher] = useState(false);
    const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
    const [showLearningReport, setShowLearningReport] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const fileInputRef = React.useRef(null);
    const { resetProfile } = useUser();
    const memorySelectorRef = useFocusTrap(showMemorySelector, () => setShowMemorySelector(false));
    const privacyModalRef = useFocusTrap(showPrivacyModal, () => setShowPrivacyModal(false));

    const handleExport = async () => {
        try {
            await exportAllData();
        } catch (err) {
            setImportMsg({ type: 'error', text: t('import_failed', { error: err.message }) });
        }
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

    const handleLogout = () => {
        if (window.confirm(t('confirm_logout'))) {
            clearAllAppData()
                .finally(() => {
                    resetProfile();
                    alert(t('logout_success'));
                    navigate('/');
                    window.location.reload();
                });
        }
    };

    const handleClearAllData = () => {
        if (window.confirm(t('privacy_clear_confirm'))) {
            clearAllAppData()
                .finally(() => {
                    resetProfile();
                    setShowPrivacyModal(false);
                    alert(t('data_cleared'));
                    window.location.reload();
                });
        }
    };

    return (
        <div className="page-container custom-scrollbar" aria-label={t('settings_control_center')}>
            {/* Ambient Background Glow */}
            <div className="page-ambient-glow" aria-hidden="true" />

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

                            <div className="glass-crystal profile-card rounded-[var(--radius-2xl)] p-6 shadow-floating">
                                {/* Active Status Ring Animation */}
                                <div className="absolute top-4 right-4 status-dot animate-pulse" />

                                <div className="flex flex-col items-center text-center">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/profile')}
                                        className="w-full flex flex-col items-center rounded-[var(--radius-xl)] focus-visible:outline-none"
                                        aria-label={`${t('profile') || 'Profile'}: ${getDisplayName(language)}`}
                                    >
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
                                    </button>

                                    <div className="grid grid-cols-3 gap-2 w-full">
                                        <button
                                            type="button"
                                            className="stat-card"
                                            onClick={() => setShowCheckIn(true)}
                                        >
                                            <div className="stat-card-label">{t('streak_stat')}</div>
                                            <div className="stat-card-value stat-value-streak">
                                                <Calendar size={14} />
                                                {streakDays}
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            className="stat-card"
                                            onClick={() => navigate('/achievements')}
                                        >
                                            <div className="stat-card-label">{t('total_points')}</div>
                                            <div className="stat-card-value stat-value-points">
                                                <Trophy size={14} />
                                                {points}
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            className="stat-card"
                                            onClick={() => setShowDailyTasks(true)}
                                        >
                                            <div className="stat-card-label">{t('daily_tasks')}</div>
                                            <div className="stat-card-value stat-value-streak">
                                                <ClipboardList size={14} />
                                                {taskProgress.completed}/{taskProgress.total}
                                            </div>
                                        </button>
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
                                    color="bg-[var(--color-icon-blue)]"
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
                                    color="bg-[var(--color-icon-green)]"
                                    label={t('privacy') || 'Privacy & Security'}
                                    onClick={() => setShowPrivacyModal(true)}
                                />
                                <SettingItem
                                    icon={<HelpCircle size={18} />}
                                    color="bg-[var(--color-icon-purple)]"
                                    label={t('help') || 'Help Center'}
                                    onClick={() => navigate('/help')}
                                />
                                <SettingItem
                                    icon={<RotateCcw size={18} />}
                                    color="bg-[var(--color-icon-teal)]"
                                    label={t('reset_tutorial')}
                                    subLabel={t('reset_tutorial_desc')}
                                    onClick={resetTutorial}
                                />
                                <SettingItem
                                    icon={<LogOut size={18} />}
                                    color="bg-[var(--color-danger)]"
                                    label={t('logout') || 'Log Out'}
                                    labelClassName="text-[var(--color-danger)]"
                                    onClick={handleLogout}
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
                                    color="bg-[var(--color-icon-indigo)]"
                                    label={t('theme_mode')}
                                    subLabel={t(`theme_${themeMode}`)}
                                    active={isDarkMode}
                                    onClick={toggleDarkMode}
                                />
                                <ControlCard
                                    icon={<Laptop size={24} />}
                                    color="bg-[var(--color-icon-gray)]"
                                    label={t('oled_mode') || 'OLED Pure Black'}
                                    subLabel={oledEnabled
                                        ? (t('oled_mode_on') || 'Enabled')
                                        : (t('oled_mode_off') || 'Disabled')}
                                    active={oledEnabled}
                                    onClick={toggleOLEDMode}
                                />
                                <ControlCard
                                    icon={<Image size={24} />}
                                    color="bg-[var(--color-icon-teal)]"
                                    label={t('backgrounds')}
                                    subLabel={t('customize_look')}
                                    active={true}
                                    onClick={() => setShowBackgroundModal(true)}
                                />
                                <ControlCard
                                    icon={<Sparkles size={24} />}
                                    color="bg-[var(--color-icon-orange)]"
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
                                    color="bg-[var(--color-icon-purple)]"
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
                                    color="bg-[var(--color-icon-pink)]"
                                    label={t('sound')}
                                    subLabel={settings.soundEnabled ? t('sound_enabled') : t('sound_muted')}
                                    active={settings.soundEnabled}
                                    onClick={toggleSound}
                                />
                                <ControlCard
                                    icon={<BellOff size={24} />}
                                    color="bg-[var(--color-icon-gray)]"
                                    label={t('do_not_disturb')}
                                    subLabel={settings.doNotDisturb ? t('dnd_active') : t('dnd_off')}
                                    active={settings.doNotDisturb}
                                    onClick={toggleDoNotDisturb}
                                />
                            </div>

                            {/* Accent Color Picker */}
                            <div className="mt-4">
                                <AccentColorPicker />
                            </div>
                        </section>

                        <section className="animate-fade-slide-up" style={{ animationDelay: '250ms' }}>
                            <div className="section-title">
                                {t('advanced_tools')}
                            </div>
                            <div className="settings-group">
                                <SettingItem
                                    icon={<Server size={18} />}
                                    color="bg-[var(--color-icon-blue)]"
                                    label={t('api_config')}
                                    subLabel={t('api_config_desc')}
                                    onClick={() => setShowApiConfig(true)}
                                />
                                <SettingItem
                                    icon={<Search size={18} />}
                                    color="bg-[var(--color-icon-brown)]"
                                    label={t('global_search')}
                                    subLabel={t('search_all_chats')}
                                    onClick={() => setShowSearch(true)}
                                />
                                <SettingItem
                                    icon={<Brain size={18} />}
                                    color="bg-[var(--color-icon-purple)]"
                                    label={t('character_memory')}
                                    subLabel={t('character_memory_settings_desc')}
                                    onClick={() => setShowMemorySelector(true)}
                                />
                                <SettingItem
                                    icon={<Database size={18} />}
                                    color="bg-[var(--color-icon-green)]"
                                    label={t('kb_title')}
                                    subLabel={t('kb_settings_desc')}
                                    onClick={() => setShowKnowledgeBase(true)}
                                />
                                <SettingItem
                                    icon={<Cpu size={18} />}
                                    color="bg-[var(--color-icon-indigo)]"
                                    label={t('model_switcher_title')}
                                    subLabel={t('model_switcher_settings_desc')}
                                    onClick={() => setShowModelSwitcher(true)}
                                />
                                <SettingItem
                                    icon={<Network size={18} />}
                                    color="bg-[var(--color-icon-purple)]"
                                    label={t('kg_title')}
                                    subLabel={t('kg_settings_desc')}
                                    onClick={() => setShowKnowledgeGraph(true)}
                                />
                                <SettingItem
                                    icon={<GraduationCap size={18} />}
                                    color="bg-[var(--color-icon-orange)]"
                                    label={t('learning_report_title')}
                                    subLabel={t('learning_report_settings_desc')}
                                    onClick={() => setShowLearningReport(true)}
                                />
                                <SettingItem
                                    icon={<Trophy size={18} />}
                                    color="bg-[var(--color-icon-brown)]"
                                    label={t('leaderboard_title')}
                                    subLabel={t('leaderboard_settings_desc')}
                                    onClick={() => navigate('/leaderboard')}
                                />
                                <SettingItem
                                    icon={<Download size={18} />}
                                    color="bg-[var(--color-icon-gray)]"
                                    label={t('export_data_title')}
                                    subLabel={t('export_data_desc')}
                                    onClick={handleExport}
                                />
                                <SettingItem
                                    icon={<Upload size={18} />}
                                    color="bg-[var(--color-icon-orange)]"
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
                                    Chat Buddy v{APP_VERSION} • Built with ❤️ by Agent Coder
                                </p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showCheckIn && <CheckInPanel onClose={() => setShowCheckIn(false)} />}
            {showDailyTasks && <DailyTaskPanel onClose={() => setShowDailyTasks(false)} />}
            {showSearch && (
                <MessageSearchPanel
                    onClose={() => setShowSearch(false)}
                    onSelectMessage={(chatId, messageId) => {
                        setShowSearch(false);
                        navigate(`/chat/${chatId}`, { state: { targetMessageId: messageId } });
                    }}
                />
            )}
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
            {showKnowledgeBase && (
                <Suspense fallback={null}>
                    <KnowledgeBasePanel onClose={() => setShowKnowledgeBase(false)} />
                </Suspense>
            )}
            {showModelSwitcher && (
                <Suspense fallback={null}>
                    <ModelSwitcherPanel onClose={() => setShowModelSwitcher(false)} />
                </Suspense>
            )}
            {showKnowledgeGraph && (
                <Suspense fallback={null}>
                    <KnowledgeGraphPanel onClose={() => setShowKnowledgeGraph(false)} />
                </Suspense>
            )}
            {showLearningReport && (
                <Suspense fallback={null}>
                    <LearningReportPanel onClose={() => setShowLearningReport(false)} />
                </Suspense>
            )}

            {/* T12: Memory character selector */}
            {showMemorySelector && (
                <div
                    className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="memory-selector-title"
                >
                      <button
                          type="button"
                          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                          onClick={() => setShowMemorySelector(false)}
                          aria-label={t('close') || 'Close'}
                      />
                    <div
                        ref={memorySelectorRef}
                        tabIndex={-1}
                        className="relative w-full max-w-sm glass-crystal rounded-[var(--radius-2xl)] shadow-floating p-5"
                        role="document"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 id="memory-selector-title" className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                                <Brain size={16} className="text-[var(--color-primary)]" />
                                {language === 'zh' ? '选择角色' : 'Select Character'}
                            </h3>
                            <button type="button" onClick={() => setShowMemorySelector(false)} aria-label={t('close') || 'Close'} className="btn btn-ghost btn-icon">
                                <span style={{ fontSize: '18px', lineHeight: 1 }}>✕</span>
                            </button>
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                            {INITIAL_PERSONAS.filter(p => p.id.startsWith('ai-')).map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => { setMemoryCharacter(p); setShowMemorySelector(false); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-[var(--radius-lg)] bg-white/5 hover:bg-white/10 transition-colors text-left"
                                >
                                    <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-full object-cover" />
                                    <div>
                                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{p.name}</p>
                                        <p className="text-xs text-[var(--color-text-secondary)] truncate">{p.personality}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* T12: Memory panel for selected character */}
            {memoryCharacter && (
                <CharacterMemoryPanel
                    character={memoryCharacter}
                    onClose={() => setMemoryCharacter(null)}
                />
            )}

            {/* Phase 1: Privacy Modal */}
            {showPrivacyModal && (
                <div
                    className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="privacy-modal-title"
                >
                      <button
                          type="button"
                          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                          onClick={() => setShowPrivacyModal(false)}
                          aria-label={t('close') || 'Close'}
                      />
                    <div ref={privacyModalRef} tabIndex={-1} className="relative w-full max-w-md glass-crystal rounded-[var(--radius-2xl)] shadow-floating p-6" role="document">
                        <div className="flex items-center justify-between mb-6">
                            <h3 id="privacy-modal-title" className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                                <Shield size={20} className="text-[var(--color-primary)]" />
                                {t('privacy_title')}
                            </h3>
                            <button type="button" onClick={() => setShowPrivacyModal(false)} aria-label={t('close') || 'Close'} className="btn btn-ghost btn-icon">
                                <span style={{ fontSize: '18px', lineHeight: 1 }}>✕</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Data Management Section */}
                            <div className="p-4 bg-white/5 rounded-[var(--radius-lg)]">
                                <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                                    <Database size={16} className="text-[var(--color-primary)]" />
                                    {t('privacy_data_management')}
                                </h4>

                                <div className="space-y-2">
                                    <button
                                        onClick={() => { setShowPrivacyModal(false); handleExport(); }}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                                    >
                                        <Download size={18} className="text-[var(--color-icon-blue)]" />
                                        <div>
                                            <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('privacy_export_data')}</p>
                                            <p className="text-xs text-[var(--color-text-secondary)]">{t('export_data_desc')}</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={handleClearAllData}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--color-danger)]/10 hover:bg-[var(--color-danger)]/20 transition-colors text-left"
                                    >
                                        <LogOut size={18} className="text-[var(--color-danger)]" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[var(--color-danger)]">{t('privacy_clear_data')}</p>
                                            <p className="text-xs text-[var(--color-danger)]/70">{t('danger_zone')}</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Privacy Info */}
                            <div className="p-4 bg-white/5 rounded-[var(--radius-lg)]">
                                <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
                                    <Info size={16} className="text-[var(--color-icon-teal)]" />
                                    {t('about')}
                                </h4>
                                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                                    {t('faq_a5')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Sub-components

function ControlCard({ icon, color, label, subLabel, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={cn("control-card", active && "active")}
            role="switch"
            aria-checked={active}
            aria-label={`${label}: ${subLabel}`}
        >
            <div className="control-card-header">
                <div className={cn("control-card-icon", color)}>
                    {icon}
                </div>
                <div className={cn("toggle", active && "active")} aria-hidden="true">
                    <div className="toggle-thumb" />
                </div>
            </div>
            <div>
                <h3 className="control-card-label">{label}</h3>
                <p className="control-card-sublabel">
                    {subLabel}
                </p>
            </div>
        </button>
    );
}

function SettingItem({ icon, color, label, subLabel, rightContent, onClick, labelClassName }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={subLabel ? `${label}: ${subLabel}` : label}
            className="setting-item w-full text-left transition-all duration-200 hover:translate-x-1 hover:shadow-sm"
        >
            <div className={cn("setting-item-icon", color)}>
                {icon}
            </div>
            <div className="setting-item-content">
                <h4 className={cn("setting-item-label", labelClassName)}>{label}</h4>
                {subLabel && <p className="setting-item-sublabel">{subLabel}</p>}
            </div>
            {rightContent || <ChevronRight size={18} className="setting-item-chevron" />}
        </button>
    );
}
