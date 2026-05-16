import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Search, MessageSquare, Sparkles, Plus, Pencil } from 'lucide-react';
import { useChat } from '../features/chat/context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';
import { getTaskSpecialists } from '../data/personas';
import { agentStore } from '../core/agents/AgentStore';
import { chatEngine } from '../core/chat/ChatEngine';
import AgentEditorModal from '../components/AgentEditorModal';

export default function AgentsPage() {
    const navigate = useNavigate();
    useChat();
    const { t, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');

    // T13: Custom agents state
    const [customAgents, setCustomAgents] = useState([]);
    const [editorOpen, setEditorOpen]   = useState(false);
    const [editingAgent, setEditingAgent] = useState(null); // null = create mode

    // Load custom agents from IndexedDB on mount and register with ChatEngine
    useEffect(() => {
        agentStore.getAllAgents().then(agents => {
            setCustomAgents(agents);
            agents.forEach(a => chatEngine.addPersona(a));
        });
    }, []);

    const builtinAgents = Array.isArray(getTaskSpecialists()) ? getTaskSpecialists() : [];
    const allAgents = [...builtinAgents, ...(Array.isArray(customAgents) ? customAgents : [])];

    const filteredAgents = allAgents.filter(agent => {
        const agentName = language === 'zh' ? (agent.name_zh || agent.name) : agent.name;
        const desc = language === 'zh' ? (agent.personality_zh || agent.personality) : agent.personality;
        const searchLower = searchTerm.toLowerCase();
        return agentName.toLowerCase().includes(searchLower) || (desc || '').toLowerCase().includes(searchLower);
    });

    const skillKeyMap = {
        'code-generation': 'skill_code_generation',
        'code-review': 'skill_code_review',
        'debugging': 'skill_debugging',
        'creative-writing': 'skill_creative_writing',
        'editing': 'skill_editing',
        'translation': 'skill_translation',
        'research': 'skill_research',
        'summarization': 'skill_summarization',
        'fact-checking': 'skill_fact_checking',
        'teaching': 'skill_teaching',
        'quiz-generation': 'skill_quiz_generation',
        'active-listening': 'skill_active_listening',
        'mindfulness': 'skill_mindfulness',
        'brainstorming': 'skill_brainstorming',
        'ui-ux': 'skill_ui_ux',
        'visual-design': 'skill_visual_design',
    };

    const translateSkill = (skill) => {
        const key = skillKeyMap[skill.toLowerCase()];
        if (key) return t(key) || skill.replace(/-/g, ' ');
        return skill.replace(/-/g, ' ');
    };

    const handleChat = (agentId) => {
        navigate(`/agents/${agentId}`);
    };

    const openCreate = (e) => {
        e.stopPropagation();
        setEditingAgent(null);
        setEditorOpen(true);
    };

    const openEdit = (e, agent) => {
        e.stopPropagation();
        setEditingAgent(agent);
        setEditorOpen(true);
    };

    const handleSave = async (agentData) => {
        const savedId = await agentStore.saveAgent(agentData);
        const saved = await agentStore.getAgentById(savedId);
        chatEngine.addPersona(saved);
        setCustomAgents(await agentStore.getAllAgents());
    };

    const handleDelete = async (agentId) => {
        await agentStore.deleteAgent(agentId);
        chatEngine.removePersona(agentId);
        setCustomAgents(await agentStore.getAllAgents());
    };

    return (
        <div className="h-full w-full flex flex-col bg-[var(--color-bg-app)] relative">
            {/* Background Ambient Glow */}
            <div className="fixed top-0 left-0 right-0 h-[400px] pointer-events-none opacity-30 select-none animate-aurora"
                style={{ background: 'radial-gradient(circle at 50% -20%, var(--color-primary) 0%, transparent 60%)' }} />

            {/* Scrollable content area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-20 md:pb-0">

            {/* Header Section with Floating Search */}
            <div className="relative z-10 px-6 py-8">
                <div className="max-w-7xl mx-auto mb-8 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="font-display font-bold text-3xl md:text-4xl text-[var(--color-text-main)] mb-2 flex items-center gap-3 animate-fade-slide-down">
                            <Sparkles className="text-[var(--color-accent-gold)] fill-current" size={28} />
                            {t('ai_assistants') || 'AI Assistants'}
                        </h1>
                        <p className="text-[var(--color-text-muted)] text-base md:text-lg max-w-2xl animate-fade-slide-down stagger-1">
                            {t('ai_assistants_desc') || 'Specialized intelligent agents ready to help you code, write, and create.'}
                        </p>
                    </div>
                    {/* Create button */}
                    <button
                        onClick={openCreate}
                        className="shrink-0 mt-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] font-bold text-sm shadow-glow transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                    >
                        <Plus size={17} />
                        <span className="hidden sm:inline">{t('create_agent')}</span>
                    </button>
                </div>

                {/* Floating Search Island */}
                <div className="max-w-7xl mx-auto mb-10 sticky top-4 z-30 animate-fade-slide-up stagger-2">
                    <div className="glass-crystal rounded-full p-2 pl-6 flex items-center shadow-floating ring-1 ring-[var(--color-border-aurora)]">
                        <Search className="text-[var(--color-text-muted)]" size={20} />
                        <input
                            type="text"
                            placeholder={t('search_agents') || 'Find your perfect AI partner...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent border-none py-3 px-4 text-[16px] text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none font-medium"
                        />
                        <div className="hidden md:flex gap-2 mr-2">
                            {[
                                { term: 'coding', label: t('filter_coding') || 'Coding' },
                                { term: 'writing', label: t('filter_writing') || 'Writing' }
                            ].map(({ term, label }) => (
                                <button
                                    key={term}
                                    onClick={() => setSearchTerm(searchTerm === term ? '' : term)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-xs font-bold transition-colors",
                                        searchTerm === term
                                            ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                                            : "bg-[var(--color-bg-active)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)]"
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bento Grid Layout */}
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-[320px]">
                    {filteredAgents.map((agent, index) => {
                        const displayName = language === 'zh' ? (agent.name_zh || agent.name) : agent.name;
                        const desc = language === 'zh' ? (agent.personality_zh || agent.personality) : agent.personality;
                        const isFeatured = index === 0 && !agent.isCustom;
                        const isCustom = Boolean(agent.isCustom);

                        return (
                            <div
                                key={agent.id}
                                onClick={() => handleChat(agent.id)}
                                className={cn(
                                    "group relative rounded-[var(--radius-2xl)] overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-glow-strong ring-1 ring-[var(--color-border)] animate-fade-slide-up",
                                    isFeatured ? "md:col-span-2 md:row-span-1" : "col-span-1"
                                )}
                                style={{ animationDelay: `${index * 50 + 150}ms` }}
                            >
                                {/* Background Image/Gradient */}
                                <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
                                    {agent.avatar ? (
                                        <>
                                            <div className={cn("absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity", agent.color?.split(' ')[0])} />
                                            <img src={agent.avatar} alt="" className="w-full h-full object-cover opacity-80" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-app)] via-[var(--color-bg-app)]/80 to-transparent/10" />
                                        </>
                                    ) : (
                                        <div className={cn(
                                            "w-full h-full bg-gradient-to-br opacity-50",
                                            agent.color || (agent.id.includes('code') ? 'from-blue-500 to-cyan-500' : 'from-purple-500 to-pink-500')
                                        )} />
                                    )}
                                </div>

                                {/* Content Overlay */}
                                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                                    {/* Action icons */}
                                    <div className="absolute top-4 right-4 flex items-center gap-2">
                                        {isCustom && (
                                            <button
                                                onClick={(e) => openEdit(e, agent)}
                                                className="glass rounded-full p-2 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:bg-white/20"
                                                title={t('btn_edit')}
                                            >
                                                <Pencil size={16} className="text-[var(--color-text-main)]" />
                                            </button>
                                        )}
                                        <div className="glass rounded-full p-2 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                            <MessageSquare size={20} className="text-[var(--color-text-main)]" />
                                        </div>
                                    </div>

                                    {/* Custom badge */}
                                    {isCustom && (
                                        <div className="absolute top-4 left-4">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold glass border border-[var(--color-border-light)] text-[var(--color-text-muted)] uppercase tracking-wider">
                                                {t('custom_badge')}
                                            </span>
                                        </div>
                                    )}

                                    <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                        <div className="flex items-center gap-3 mb-2">
                                            {agent.avatar ? (
                                                <div className="w-10 h-10 rounded-xl overflow-hidden glass shadow-sm">
                                                    <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", "bg-gradient-to-br", agent.color || 'from-purple-500 to-pink-500')}>
                                                    <Bot size={20} className="text-white" />
                                                </div>
                                            )}
                                            <h3 className="font-display font-bold text-2xl text-[var(--color-text-primary)] drop-shadow-md">
                                                {displayName}
                                            </h3>
                                        </div>

                                        <p className="text-white/90 line-clamp-2 md:line-clamp-3 mb-4 text-sm font-medium leading-relaxed opacity-90 group-hover:opacity-100 drop-shadow">
                                            {desc || t('custom_agent_desc')}
                                        </p>

                                        <div className="flex flex-wrap gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                            {agent.skills?.slice(0, isFeatured ? 5 : 2).map((skill, i) => (
                                                <span key={i} className="px-2.5 py-1 rounded-md bg-black/40 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm border border-white/10 backdrop-blur-md">
                                                    {translateSkill(skill)}
                                                </span>
                                            ))}
                                            {agent.skills?.length > (isFeatured ? 5 : 2) && (
                                                <span className="px-2 py-1 text-[10px] text-[var(--color-text-muted)] font-bold">
                                                    +{agent.skills.length - (isFeatured ? 5 : 2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredAgents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-[var(--color-text-muted)] animate-fade-in">
                        <div className="w-24 h-24 rounded-full bg-[var(--color-bg-active)] flex items-center justify-center mb-6 animate-float">
                            <Bot size={48} className="opacity-50" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">{t('no_agents_found') || 'No agents found'}</h3>
                        <p className="text-sm opacity-70 max-w-xs text-center">
                            {t('try_different_search') || 'Try adjusting your search terms to find the right assistant.'}
                        </p>
                        <button onClick={openCreate} className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold text-sm hover:bg-[var(--color-primary-hover)] transition-colors">
                            <Plus size={16} /> {t('create_first_agent')}
                        </button>
                    </div>
                )}
            </div>

            </div>

            {/* Agent Editor Modal (outside scroll container) */}
            <AgentEditorModal
                isOpen={editorOpen}
                agent={editingAgent}
                onSave={handleSave}
                onDelete={handleDelete}
                onClose={() => setEditorOpen(false)}
            />
        </div>
    );
}
