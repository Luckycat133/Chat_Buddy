import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Search } from 'lucide-react';
import { useChat } from './context/ChatContext';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils/cn';

export default function CreateChat() {
    const navigate = useNavigate();
    const { personas, createChat } = useChat();
    const { t, language } = useLanguage();
    const [selectedIds, setSelectedIds] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const toggleSelection = (id) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id]
        );
    };

    const handleCreate = () => {
        if (selectedIds.length === 0) return;

        let finalName = groupName;
        if (!finalName) {
            if (selectedIds.length === 1) {
                const p = personas.find(p => p.id === selectedIds[0]);
                finalName = language === 'zh' ? (p.name_zh || p.name) : p.name;
            } else {
                const names = selectedIds.slice(0, 3).map(id => {
                    const p = personas.find(x => x.id === id);
                    return language === 'zh' ? (p.name_zh || p.name) : p.name;
                });
                finalName = names.join(', ') + (selectedIds.length > 3 ? ` +${selectedIds.length - 3}` : '');
            }
        }

        const newChatId = createChat(finalName, selectedIds);
        navigate(`/chat/${newChatId}`);
    };

    const filteredPersonas = personas.filter(p => {
        const name = language === 'zh' ? (p.name_zh || p.name) : p.name;
        return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-hidden flex flex-col pb-16 md:pb-0">
            {/* Header */}
            <div className="bg-[var(--color-bg-app)] px-3 py-2 flex items-center justify-between border-b border-[var(--color-border)]">
                <button onClick={() => navigate(-1)} className="text-[var(--color-text-main)] text-[16px]">
                    {t('cancel') || 'Cancel'}
                </button>
                <h1 className="text-[17px] font-medium text-[var(--color-text-main)]">{t('create_title')}</h1>
                <button
                    onClick={handleCreate}
                    disabled={selectedIds.length === 0}
                    className={cn(
                        "text-[16px] font-medium",
                        selectedIds.length > 0 ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                    )}
                >
                    {t('done') || 'Done'}{selectedIds.length > 0 && `(${selectedIds.length})`}
                </button>
            </div>

            {/* Search */}
            <div className="p-2 bg-[var(--color-bg-app)]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#B2B2B2]" size={14} />
                    <input
                        type="text"
                        placeholder={t('search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[var(--color-bg-white)] border-none rounded py-1.5 pl-8 pr-3 text-sm placeholder:text-[#B2B2B2] focus:outline-none"
                    />
                </div>
            </div>

            {/* Group Name Input */}
            {selectedIds.length > 1 && (
                <div className="bg-[var(--color-bg-white)] px-4 py-3 mb-2 border-b border-[var(--color-border)]">
                    <input
                        type="text"
                        placeholder={t('group_name_placeholder')}
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="w-full text-[15px] placeholder:text-[#B2B2B2] focus:outline-none"
                    />
                </div>
            )}

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto bg-[var(--color-bg-white)]">
                {filteredPersonas.map((persona) => {
                    const isSelected = selectedIds.includes(persona.id);
                    const pName = language === 'zh' ? (persona.name_zh || persona.name) : persona.name;

                    return (
                        <div
                            key={persona.id}
                            onClick={() => toggleSelection(persona.id)}
                            className="flex items-center px-4 py-2.5 border-b border-[var(--color-border-light)] active:bg-[#ECECEC] cursor-pointer"
                        >
                            {/* Checkbox */}
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center flex-shrink-0",
                                isSelected
                                    ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                                    : "border-[#C7C7CC]"
                            )}>
                                {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                            </div>

                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-[4px] overflow-hidden flex-shrink-0 bg-[#E0E0E0] mr-3">
                                <img src={persona.avatar} alt={pName} className="w-full h-full object-cover" />
                            </div>

                            {/* Name */}
                            <span className="text-[16px] text-[var(--color-text-main)]">{pName}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
