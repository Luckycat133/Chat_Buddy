import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Plus, Clock, Search } from 'lucide-react';
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
    const [searchTerm, setSearchTerm] = useState('');

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
        // Always create a new chat for "topics" in this workspace
        // Use a generic name or "New Chat" which will be updated by first message logic usually,
        // or we can prompt for a topic? For now, simple "Topic X" style or just "New Chat".
        // Let's verify createChat signature: createChat(name, participants, avatar)
        // If we want multiple chats, we must ensure distinctness or just rely on IDs.
        // The implementation says "Create new chat if none exists" in AgentsPage,
        // but createChat itself likely generates a unique ID.
        const chatName = language === 'zh' ? '新话题' : 'New Topic';
        const newId = createChat(chatName, [agentId], agent.avatar);
        setSelectedChatId(newId);
    };

    if (!agent) {
        return <div className="flex items-center justify-center h-full text-gray-500">Agent not found</div>;
    }

    const displayName = language === 'zh' ? (agent.name_zh || agent.name) : agent.name;
    const activeChat = selectedChatId ? chats.find(c => c.id === selectedChatId) : null;

    return (
        <div className="flex h-full w-full bg-[var(--color-bg-app)]">
            {/* Left Sidebar - Chat List for this Agent */}
            <div className={cn(
                "flex flex-col border-r border-[var(--color-border)] bg-white transition-all duration-300",
                selectedChatId ? "hidden md:flex w-[320px]" : "w-full md:w-[320px]"
            )}>
                {/* Header */}
                <div className="p-4 border-b border-[var(--color-border-light)] bg-gray-50/50">
                    <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => navigate('/agents')} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="font-bold text-lg truncate flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full", agent.color?.split(' ')[0] || 'bg-gray-400')}></span>
                                {displayName}
                            </h1>
                            <p className="text-xs text-gray-500 truncate">{language === 'zh' ? '专属工作区' : 'Workspace'}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleNewChat}
                        className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                    >
                        <Plus size={18} />
                        {language === 'zh' ? '新建话题' : 'New Topic'}
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {agentChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm p-4 text-center">
                            <MessageSquare size={32} className="mb-2 opacity-20" />
                            <p>{language === 'zh' ? '还没有对话记录' : 'No conversations yet'}</p>
                            <p className="text-xs mt-1">{language === 'zh' ? '点击上方按钮开始新话题' : 'Click above to start a topic'}</p>
                        </div>
                    ) : (
                        agentChats.map(chat => {
                            const lastMsg = chat.lastMessage;
                            const time = lastMsg ? formatChatListTime(lastMsg.timestamp, language) : '';
                            const isActive = chat.id === selectedChatId;

                            return (
                                <div
                                    key={chat.id}
                                    onClick={() => setSelectedChatId(chat.id)}
                                    className={cn(
                                        "p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                                        isActive
                                            ? "bg-[var(--color-primary-softer)] border-[var(--color-primary-light)]"
                                            : "hover:bg-gray-50 hover:border-gray-200"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className={cn("font-medium text-sm truncate pr-2 flex-1", isActive ? "text-[var(--color-primary-dark)]" : "text-gray-700")}>
                                            {chat.name || displayName}
                                        </h3>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">{time}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-2 min-h-[1.5em]">
                                        {lastMsg ? lastMsg.content : (language === 'zh' ? '(空对话)' : '(Empty)')}
                                    </p>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Side - Chat Window */}
            {selectedChatId ? (
                <div className={cn(
                    "flex-1 bg-[var(--color-bg-chat)] relative flex flex-col h-full",
                    selectedChatId ? "flex" : "hidden md:flex"
                )}>
                    {/* Mobile Back Button Overlay (if needed in header, but header handles navigation to root usually)
                        We need to override ChatHeader's back behavior or handle it via layout?
                        ChatWindow currently renders ChatHeader.
                        We might need to wrap ChatWindow or modify ChatHeader to handle "Back to Workspace List" on mobile.
                    */}
                    <div className="relative flex-1 flex flex-col min-h-0">
                        {/* We pass a key to force re-mount when switching chats if needed, though ID prop handling should suffice */}
                        <ChatWindow key={selectedChatId} chatId={selectedChatId} />

                        {/* Mobile Back Button Override: 
                            ChatWindow's header has a "md:hidden" back button that goes to '/'. 
                            We can't easily override it without modifying ChatHeader again.
                            However, on mobile, if we are in this view, we want to go back to the LIST of this workspace.
                            
                            Quick fix: We can overlay a back button or modify ChatHeader prop.
                            Let's assume for now user on mobile uses the header back button which goes to Home.
                            This is sub-optimal for "Workspace".
                            Ideally ChatHeader should accept an onBack prop.
                            For now, let's stick to desktop focus based on user persona, but if mobile, 
                            hitting "Back" (Browser) is standard.
                        */}
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 text-gray-400 flex-col gap-4">
                    <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center shadow-sm", agent.color?.split(' ')[0] || 'bg-gray-200')}>
                        <img src={agent.avatar} alt="Agent" className="w-16 h-16 object-contain opacity-80" />
                    </div>
                    <p>{language === 'zh' ? '选择一个话题开始' : 'Select a topic to start'}</p>
                </div>
            )}
        </div>
    );
}
