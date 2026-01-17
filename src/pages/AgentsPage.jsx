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
        <div className="flex-1 h-full bg-[var(--color-bg-app)] overflow-y-auto pb-20 md:pb-0">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b border-[var(--color-border-light)]">
                <div>
                    <h1 className="text-xl font-bold text-[var(--color-text-main)] flex items-center gap-2">
                        <Bot className="text-[var(--color-primary)]" />
                        {t('ai_assistants') || 'AI Assistants'}
                    </h1>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {t('ai_assistants_desc') || 'Specialized agents for coding, writing, and research'}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="px-6 py-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder={t('search_agents') || 'Search agents...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-[var(--color-border)] rounded-xl py-3 pl-10 pr-4 shadow-sm focus:outline-none focus:border-[var(--color-primary)] focus:shadow-md transition-all"
                    />
                </div>
            </div>

            {/* Agents Grid */}
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAgents.map((agent, index) => {
                    const displayName = language === 'zh' ? (agent.name_zh || agent.name) : agent.name;
                    const desc = language === 'zh' ? (agent.personality_zh || agent.personality) : agent.personality;

                    return (
                        <div
                            key={agent.id}
                            className="bg-white rounded-2xl p-5 border border-[var(--color-border-light)] shadow-sm hover:shadow-float hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col h-full"
                            onClick={() => handleChat(agent.id)}
                            style={{ animation: `fadeIn 0.5s ease-out ${index * 50}ms backwards` }}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={cn(
                                    "w-16 h-16 rounded-2xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center bg-gray-50",
                                    agent.color?.split(' ')[0]
                                )}>
                                    <img
                                        src={agent.avatar}
                                        alt={displayName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.parentElement.innerHTML = '<span class="text-2xl">🤖</span>';
                                        }}
                                    />
                                </div>
                                <div className="p-2 bg-[var(--color-bg-app)] rounded-full text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors shadow-sm">
                                    <MessageSquare size={18} />
                                </div>
                            </div>

                            <h3 className="font-bold text-lg text-[var(--color-text-main)] mb-1">{displayName}</h3>
                            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3 mb-4 flex-grow">
                                {desc}
                            </p>

                            <div className="mt-auto flex flex-wrap gap-2">
                                {agent.skills?.slice(0, 3).map((skill, i) => (
                                    <span key={i} className="text-[10px] px-2 py-1 rounded-md bg-gray-100 text-gray-600 font-medium uppercase tracking-wider">
                                        {skill.replace(/-/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}


                {filteredAgents.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                        <Bot size={48} className="mb-4 opacity-20" />
                        <p>{t('no_agents_found') || 'No agents found matching your search.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
