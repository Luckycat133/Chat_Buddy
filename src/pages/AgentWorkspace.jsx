import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Plus } from 'lucide-react';
import { useChat } from '../features/chat/context/ChatContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../utils/cn';
import ChatWindow from '../features/chat/ChatWindow';
import { formatChatListTime } from '../utils/formatTime';

export default function AgentWorkspace() {
    const { agentId } = useParams();
    const navigate = useNavigate();
    const { chats, createChat, personas } = useChat();
    const { t, language } = useLanguage();

    const [selectedChatId, setSelectedChatId] = useState(null);
    const localizedNewTopicName = t('agent_new_topic') || (language === 'zh' ? '新话题' : 'New Topic');

    // Find agent details
    const agent = personas.find(p => p.id === agentId);

    // Filter chats for this agent
    const agentChats = useMemo(() => {
        if (!agentId) return [];
        return chats
            .filter(chat => chat.participants.includes(agentId))
            .sort((a, b) => {
                const aTime = a.lastMessage?.timestamp || a.createdAt;
                const bTime = b.lastMessage?.timestamp || b.createdAt;
                return new Date(bTime) - new Date(aTime);
            });
    }, [chats, agentId]);

    // Handle creating a new chat
    const handleNewChat = () => {
        if (!agent) return;
        const newId = createChat(localizedNewTopicName, [agentId], agent.avatar);
        setSelectedChatId(newId);
    };

    const normalizeTopicTitle = (name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return '';
        if (trimmed === '新话题' || trimmed === 'New Topic') {
            return localizedNewTopicName;
        }
        return trimmed;
    };

    if (!agent) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                {t('agent_not_found') || 'Agent not found'}
            </div>
        );
    }

    const displayName = language === 'zh' ? (agent.name_zh || agent.name) : agent.name;
    const _activeChat = selectedChatId ? chats.find(c => c.id === selectedChatId) : null;

    return (
        <div className="flex h-full w-full bg-[var(--color-bg-app)] overflow-hidden">
            {/* Left Sidebar - Chat List */}
            <div className={cn(
                "flex flex-col border-r border-[var(--color-border)] glass-strong transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                selectedChatId ? "hidden md:flex w-[320px]" : "w-full md:w-[320px]"
            )}>
                {/* Header */}
                <div className="p-4 border-b border-[var(--color-border-light)]">
                    <div className="flex items-center gap-3 mb-6">
                        <button onClick={() => navigate('/agents')}
                            className="p-2 -ml-2 rounded-xl hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="font-display font-bold text-lg truncate flex items-center gap-2 text-[var(--color-text-main)]">
                                <span className={cn("w-2.5 h-2.5 rounded-full shadow-glow", agent.color?.split(' ')[0] || 'bg-[var(--color-bg-active)]')}></span>
                                {displayName}
                            </h1>
                            <p className="text-xs text-[var(--color-text-muted)] truncate font-medium">
                                {t('agent_workspace_label') || (language === 'zh' ? '专属工作区' : 'Workspace')}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleNewChat}
                        className="w-full py-3 bg-[var(--gradient-aurora)] hover:shadow-glow-strong text-[var(--color-on-primary)] rounded-[var(--radius-lg)] font-bold flex items-center justify-center gap-2 transition-all duration-300 hover:-translate-y-0.5 active:scale-95 active:translate-y-0 text-[15px]"
                    >
                        <Plus size={20} />
                        {localizedNewTopicName}
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {agentChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[60%] text-[var(--color-text-muted)] text-sm p-4 text-center animate-fade-slide-up">
                            <div className="w-16 h-16 rounded-3xl bg-[var(--color-bg-hover)] flex items-center justify-center mb-4 animate-float">
                                <MessageSquare size={24} className="opacity-40" />
                            </div>
                            <p className="font-medium mb-1">{t('agent_no_conversations') || (language === 'zh' ? '还没有对话记录' : 'No conversations yet')}</p>
                            <p className="text-xs opacity-70">{t('agent_start_topic_hint') || (language === 'zh' ? '点击上方按钮开始新话题' : 'Click above to start a topic')}</p>
                        </div>
                    ) : (
                        agentChats.map((chat, index) => {
                            const lastMsg = chat.lastMessage;
                            const time = lastMsg ? formatChatListTime(lastMsg.timestamp, language) : '';
                            const isActive = chat.id === selectedChatId;

                            return (
                                <div
                                    key={chat.id}
                                    onClick={() => setSelectedChatId(chat.id)}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                    className={cn(
                                        "group p-3.5 rounded-[var(--radius-lg)] cursor-pointer transition-all duration-300 border animate-fade-slide-up",
                                        isActive
                                            ? "glass-aurora border-[var(--color-border-aurora)] shadow-md translate-x-1"
                                            : "border-transparent hover:bg-[var(--color-bg-hover)] hover:translate-x-1"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <h3 className={cn(
                                            "font-bold text-[15px] truncate pr-2 flex-1 transition-colors",
                                            isActive ? "text-[var(--color-primary-active)]" : "text-[var(--color-text-main)] group-hover:text-[var(--color-primary)]"
                                        )}>
                                            {normalizeTopicTitle(chat.name) || displayName}
                                        </h3>
                                        <span className="text-[11px] text-[var(--color-text-light)] whitespace-nowrap pt-0.5 font-medium">{time}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className={cn(
                                            "text-xs line-clamp-1 min-h-[1.5em] flex-1",
                                            isActive ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"
                                        )}>
                                            {lastMsg ? lastMsg.content : (t('agent_empty_chat') || (language === 'zh' ? '(空对话)' : '(Empty)'))}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Side - Chat Window */}
            {selectedChatId ? (
                <div className={cn(
                    "flex-1 relative flex flex-col h-full overflow-hidden bg-[var(--color-bg-chat)]",
                    selectedChatId ? "flex" : "hidden md:flex"
                )}>
                    <div className="relative flex-1 flex flex-col min-h-0 animate-fade-in">
                        <ChatWindow key={selectedChatId} chatId={selectedChatId} />
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 items-center justify-center bg-[var(--color-bg-app)] relative overflow-hidden">
                    {/* Background blob animation */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-primary)]/5 rounded-full blur-[100px] animate-pulse" />

                    <div className="flex flex-col items-center gap-6 relative z-10 animate-scale-spring">
                        <div className={cn(
                            "w-24 h-24 rounded-[var(--radius-2xl)] flex items-center justify-center shadow-floating glass-crystal",
                            !agent.avatar && (agent.color?.split(' ')[0] || 'bg-[var(--color-bg-active)]')
                        )}>
                            <img src={agent.avatar} alt="Agent" className="w-20 h-20 object-contain drop-shadow-md" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-display font-bold text-[var(--color-text-main)] mb-2">
                                {(t('agent_start_chat_with', { name: displayName }) || (language === 'zh' ? `与 ${displayName} 开始对话` : `Start chatting with ${displayName}`))}
                            </h2>
                            <p className="text-[var(--color-text-muted)]">
                                {t('agent_select_or_create_topic') || (language === 'zh' ? '选择一个话题或创建新话题' : 'Select a topic or create a new one')}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
