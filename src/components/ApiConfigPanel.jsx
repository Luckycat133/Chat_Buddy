import React, { useState, useEffect, useRef } from 'react';
import {
    X, Server, Key, Cpu, Thermometer, Zap, Save,
    RotateCcw, Plus, Trash2, Check, AlertCircle, Loader2
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
    getConfig, saveConfig, clearConfig, isConfigured,
    validateConfig, getProfiles, saveProfile, deleteProfile, loadProfile
} from '../config/apiConfig';
import { resetAIClient } from '../services/api/aiClient';
import { cn } from '../utils/cn';

export default function ApiConfigPanel({ onClose }) {
    const { t } = useLanguage();
    const [config, setConfig] = useState(getConfig);
    const [profiles, setProfiles] = useState(getProfiles);
    const [testStatus, setTestStatus] = useState(null); // null | 'testing' | {valid,error,latency}
    const [saved, setSaved] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [showProfileInput, setShowProfileInput] = useState(false);
    const panelRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const updateField = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setSaved(false);
        setTestStatus(null);
    };

    const handleSave = () => {
        saveConfig(config);
        resetAIClient();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleReset = () => {
        clearConfig();
        resetAIClient();
        setConfig(getConfig());
        setTestStatus(null);
    };

    const handleTest = async () => {
        if (!config.baseUrl || !config.apiKey || !config.model) {
            setTestStatus({ valid: false, error: t('missing_fields') });
            return;
        }
        setTestStatus('testing');
        const result = await validateConfig(config);
        setTestStatus(result);
    };

    const handleSaveProfile = () => {
        if (!profileName.trim()) return;
        const updated = saveProfile(profileName.trim(), {
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            model: config.model,
            temperature: config.temperature,
        });
        setProfiles(updated);
        setProfileName('');
        setShowProfileInput(false);
    };

    const handleLoadProfile = (name) => {
        loadProfile(name);
        resetAIClient();
        setConfig(getConfig());
        setTestStatus(null);
    };

    const handleDeleteProfile = (name) => {
        setProfiles(deleteProfile(name));
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                ref={panelRef}
                className="bg-[var(--color-bg-white)] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[var(--color-bg-white)] flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-main)]">{t('api_config')}</h2>
                        <p className="text-xs text-[var(--color-text-muted)]">{t('api_config_desc')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors">
                        <X size={20} className="text-[var(--color-text-muted)]" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Base URL */}
                    <FieldGroup icon={<Server size={16} />} label={t('api_base_url')} required>
                        <input
                            type="url"
                            value={config.baseUrl}
                            onChange={e => updateField('baseUrl', e.target.value)}
                            placeholder={t('api_base_url_placeholder')}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-light)]"
                        />
                    </FieldGroup>

                    {/* API Key */}
                    <FieldGroup icon={<Key size={16} />} label={t('api_key')} required>
                        <input
                            type="password"
                            value={config.apiKey}
                            onChange={e => updateField('apiKey', e.target.value)}
                            placeholder={t('api_key_placeholder')}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-light)]"
                        />
                    </FieldGroup>

                    {/* Model */}
                    <FieldGroup icon={<Cpu size={16} />} label={t('model_name')} required>
                        <input
                            type="text"
                            value={config.model}
                            onChange={e => updateField('model', e.target.value)}
                            placeholder={t('model_name_placeholder')}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-light)]"
                        />
                    </FieldGroup>

                    {/* Temperature */}
                    <FieldGroup icon={<Thermometer size={16} />} label={`${t('temperature')}: ${config.temperature}`}>
                        <input
                            type="range"
                            min="0" max="2" step="0.1"
                            value={config.temperature}
                            onChange={e => updateField('temperature', parseFloat(e.target.value))}
                            className="w-full accent-[var(--color-primary)]"
                        />
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('temperature_desc')}</p>
                    </FieldGroup>

                    {/* Test Connection */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleTest}
                            disabled={testStatus === 'testing'}
                            className={cn(
                                "flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all",
                                testStatus === 'testing'
                                    ? "bg-[var(--color-bg-app)] text-[var(--color-text-muted)] cursor-wait"
                                    : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                            )}
                        >
                            {testStatus === 'testing' ? (
                                <><Loader2 size={16} className="animate-spin" /> {t('testing_connection')}</>
                            ) : (
                                <><Zap size={16} /> {t('test_connection')}</>
                            )}
                        </button>
                    </div>

                    {/* Test Result */}
                    {testStatus && testStatus !== 'testing' && (
                        <div className={cn(
                            "flex items-center gap-2 px-4 py-3 rounded-xl text-sm",
                            testStatus.valid
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                        )}>
                            {testStatus.valid ? <Check size={16} /> : <AlertCircle size={16} />}
                            {testStatus.valid
                                ? t('connection_success', { latency: testStatus.latency })
                                : t('connection_failed', { error: testStatus.error })
                            }
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSave}
                            className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2"
                        >
                            {saved ? <Check size={16} /> : <Save size={16} />}
                            {saved ? t('config_saved') : t('save_config')}
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-4 py-2.5 rounded-xl font-medium text-sm bg-[var(--color-bg-app)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-all flex items-center gap-2"
                        >
                            <RotateCcw size={16} /> {t('reset_config')}
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-[var(--color-border)]" />

                    {/* Provider Profiles */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-[var(--color-text-main)]">{t('provider_profiles')}</h3>
                            <button
                                onClick={() => setShowProfileInput(!showProfileInput)}
                                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                            >
                                <Plus size={16} className="text-[var(--color-primary)]" />
                            </button>
                        </div>

                        {showProfileInput && (
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={profileName}
                                    onChange={e => setProfileName(e.target.value)}
                                    placeholder={t('profile_name_placeholder')}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-main)] text-sm outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-light)] flex-1"
                                    onKeyDown={e => e.key === 'Enter' && handleSaveProfile()}
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveProfile}
                                    className="px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium"
                                >
                                    {t('save')}
                                </button>
                            </div>
                        )}

                        {profiles.length === 0 ? (
                            <p className="text-xs text-[var(--color-text-muted)] text-center py-4">{t('no_profiles')}</p>
                        ) : (
                            <div className="space-y-2">
                                {profiles.map(p => (
                                    <div key={p.name} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--color-bg-app)] border border-[var(--color-border-light)]">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[var(--color-text-main)] truncate">{p.name}</p>
                                            <p className="text-xs text-[var(--color-text-muted)] truncate">{p.config.model}</p>
                                        </div>
                                        <button
                                            onClick={() => handleLoadProfile(p.name)}
                                            className="px-2.5 py-1 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-medium hover:bg-[var(--color-primary)]/20"
                                        >
                                            {t('load_profile')}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProfile(p.name)}
                                            className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Reusable form field wrapper */
function FieldGroup({ icon, label, required, children }) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-main)] mb-1.5">
                {icon}
                {label}
                {required && <span className="text-red-400">*</span>}
            </label>
            {children}
        </div>
    );
}
