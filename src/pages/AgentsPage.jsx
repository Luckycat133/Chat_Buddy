import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Search, MessageSquare, Sparkles } from 'lucide-react';
import { useChat } from '../features/chat/context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';
import { getTaskSpecialists } from '../data/personas';

export default function AgentsPage() {
    const navigate = useNavigate();
    const { chats, createChat } = useChat();
    const { t, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch only Task Specialist Agents
    const taskAgents = getTaskSpecialists();

    const filteredAgents = taskAgents.filter(agent => {
        const name = language === 'zh' ? (agent.name_zh || agent.name) : agent.name;
        const desc = language === 'zh' ? (agent.personality_zh || agent.personality) : agent.personality;
        const searchLower = searchTerm.toLowerCase();
        return name.toLowerCase().includes(searchLower) || desc.toLowerCase().includes(searchLower);
    });

    const handleChat = (agentId) => {
        // Navigate to the agent's dedicated workspace
        navigate(`/agents/${agentId}`);
    };

    return (
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto pb-20 md:pb-0 relative custom-scrollbar">
            {/* Background Ambient Glow */}
            <div className="fixed top-0 left-0 right-0 h-[400px] pointer-events-none opacity-30 select-none animate-aurora"
                style={{ background: 'radial-gradient(circle at 50% -20%, var(--color-primary) 0%, transparent 60%)' }} />

            {/* Header Section with Floating Search */}
            <div className="relative z-10 px-6 py-8">
                <div className="max-w-7xl mx-auto mb-8">
                    <h1 className="font-display font-bold text-3xl md:text-4xl text-[var(--color-text-main)] mb-2 flex items-center gap-3 animate-fade-slide-down">
                        <Sparkles className="text-[var(--color-accent-gold)] fill-current" size={28} />
                        {t('ai_assistants') || 'AI Assistants'}
                    </h1>
                    <p className="text-[var(--color-text-muted)] text-base md:text-lg max-w-2xl animate-fade-slide-down stagger-1">
                        {t('ai_assistants_desc') || 'Specialized intelligent agents ready to help you code, write, and create.'}
                    </p>
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
                            {['Coding', 'Writing'].map(tag => (
                                <button key={tag} className="px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--color-bg-active)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors">
                                    {tag}
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
                        // Featured card logic (first one or specific IDs could be larger)
                        const isFeatured = index === 0;

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
                                            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-app)] via-[var(--color-bg-app)]/50 to-transparent" />
                                        </>
                                    ) : (
                                        <div className={cn("w-full h-full bg-gradient-to-br opacity-50",
                                            agent.id.includes('code') ? 'from-blue-500 to-cyan-500' : 'from-purple-500 to-pink-500'
                                        )} />
                                    )}
                                </div>

                                {/* Content Overlay */}
                                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                                    <div className="absolute top-4 right-4 glass rounded-full p-2 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                        <MessageSquare size={20} className="text-[var(--color-text-main)]" />
                                    </div>

                                    <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-xl overflow-hidden glass shadow-sm">
                                                <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <h3 className="font-display font-bold text-2xl text-[var(--color-text-main)] drop-shadow-sm">
                                                {displayName}
                                            </h3>
                                        </div>

                                        <p className="text-[var(--color-text-secondary)] line-clamp-2 md:line-clamp-3 mb-4 text-sm font-medium leading-relaxed opacity-90 group-hover:opacity-100">
                                            {desc}
                                        </p>

                                        <div className="flex flex-wrap gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                            {agent.skills?.slice(0, isFeatured ? 5 : 2).map((skill, i) => (
                                                <span key={i} className="px-2.5 py-1 rounded-md glass-strong text-[10px] font-bold text-[var(--color-text-main)] uppercase tracking-wider shadow-sm border border-[var(--color-border-light)]">
                                                    {skill.replace(/-/g, ' ')}
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
                    </div>
                )}
            </div>
        </div>
    );
}
