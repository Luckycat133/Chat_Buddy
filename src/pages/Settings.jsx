import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { ChevronRight, User, Bell, Lock, Globe, Info, Moon, HelpCircle } from 'lucide-react';
import { cn } from '../utils/cn';

export default function Settings() {
    const { language, toggleLanguage, t } = useLanguage();
    const navigate = useNavigate();

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto pb-16 md:pb-0">
            {/* Profile Card */}
            <div className="bg-white px-4 py-5 mb-2 flex items-center gap-4">
                <div className="w-16 h-16 bg-[var(--color-primary)] rounded-[4px] flex items-center justify-center text-white text-2xl font-bold">
                    Y
                </div>
                <div className="flex-1">
                    <h3 className="font-medium text-[var(--color-text-main)] text-[17px]">{t('you')}</h3>
                    <p className="text-[var(--color-text-muted)] text-[14px] mt-0.5">ID: user123</p>
                </div>
                <ChevronRight size={20} className="text-[#C7C7CC]" />
            </div>

            {/* Settings Groups */}
            <div className="bg-white mb-2">
                <SettingItem icon={<Bell size={22} />} iconBg="bg-[#F44336]" label={t('notifications') || 'Notifications'} />
                <SettingItem icon={<Lock size={22} />} iconBg="bg-[#4CAF50]" label={t('privacy') || 'Privacy'} />
                <SettingItem icon={<Globe size={22} />} iconBg="bg-[#9C27B0]" label={t('general') || 'General'} />
            </div>

            <div className="bg-white mb-2">
                <SettingItem
                    icon={<Globe size={22} />}
                    iconBg="bg-[#2196F3]"
                    label={t('interface_language')}
                    value={language === 'en' ? 'English' : '简体中文'}
                    onClick={toggleLanguage}
                />
            </div>

            <div className="bg-white mb-2">
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
                    value="v0.2.0"
                    onClick={() => navigate('/about')}
                />
            </div>
        </div>
    );
}

function SettingItem({ icon, iconBg, label, value, onClick }) {
    return (
        <div
            className="flex items-center px-4 py-3 border-b border-[var(--color-border-light)] last:border-b-0 active:bg-[#ECECEC] cursor-pointer"
            onClick={onClick}
        >
            <div className={cn("w-8 h-8 rounded-[6px] flex items-center justify-center text-white mr-3", iconBg)}>
                {icon}
            </div>
            <span className="flex-1 text-[16px] text-[var(--color-text-main)]">{label}</span>
            {value && <span className="text-[var(--color-text-muted)] text-[15px] mr-1">{value}</span>}
            <ChevronRight size={20} className="text-[#C7C7CC]" />
        </div>
    )
}

