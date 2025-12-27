import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { INITIAL_PERSONAS } from '../data/personas';

const ChatContext = createContext();

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChat must be used within a ChatProvider');
    return context;
};

export const ChatProvider = ({ children }) => {
    // Data State
    const [personas] = useState(INITIAL_PERSONAS);
    const [chats, setChats] = useLocalStorage('chat-buddy-chats', []);
    const [currentUser] = useState({ id: 'user-me', name: 'You', avatar: null });

    // Typing indicators state
    const [typingIndicators, setTypingIndicators] = useState({});

    // Track processed messages to prevent duplicate processing
    const processedMessagesRef = useRef(new Set());

    // Track scheduled proactive messages
    const scheduledMessagesRef = useRef(new Map()); // Map<chatId-aiId, timeoutId>

    // CRITICAL: Keep a ref to the latest chats state for use in async callbacks
    const chatsRef = useRef(chats);
    useEffect(() => {
        chatsRef.current = chats;
    }, [chats]);

    // Logic: Send Message
    const sendMessage = useCallback((chatId, content, senderId = 'user-me') => {
        // Cancel any scheduled proactive messages when user sends a message
        scheduledMessagesRef.current.forEach((timeoutId, key) => {
            if (key.startsWith(chatId)) {
                clearTimeout(timeoutId);
                scheduledMessagesRef.current.delete(key);
            }
        });

        setChats(prevChats => prevChats.map(chat => {
            if (chat.id !== chatId) return chat;

            const newMessage = {
                id: crypto.randomUUID(),
                senderId,
                content,
                timestamp: new Date().toISOString(),
                status: 'sent'
            };

            return {
                ...chat,
                messages: [...chat.messages, newMessage],
                lastMessage: newMessage
            };
        }));
    }, [setChats]);

    // Logic: Create Chat
    const createChat = useCallback((name, selectedPersonaIds) => {
        const newChat = {
            id: crypto.randomUUID(),
            name,
            participants: ['user-me', ...selectedPersonaIds],
            messages: [],
            createdAt: new Date().toISOString()
        };
        setChats(prev => [newChat, ...prev]);
        return newChat.id;
    }, [setChats]);

    // Logic: Update Chat
    const updateChat = useCallback((chatId, updates) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, ...updates } : chat
        ));
    }, [setChats]);

    // Logic: Delete Chat
    const deleteChat = useCallback((id) => {
        // Clear scheduled messages for this chat
        scheduledMessagesRef.current.forEach((timeoutId, key) => {
            if (key.startsWith(id)) {
                clearTimeout(timeoutId);
                scheduledMessagesRef.current.delete(key);
            }
        });
        setChats(prev => prev.filter(c => c.id !== id));
    }, [setChats]);

    // Logic: Delete/Recall Message
    const deleteMessage = useCallback((chatId, messageId) => {
        setChats(prev => prev.map(chat => {
            if (chat.id !== chatId) return chat;
            const updatedMessages = chat.messages.filter(m => m.id !== messageId);
            return {
                ...chat,
                messages: updatedMessages,
                lastMessage: updatedMessages[updatedMessages.length - 1] || null
            };
        }));
    }, [setChats]);

    // Logic: Clear Chat History
    const clearChatMessages = useCallback((chatId) => {
        setChats(prev => prev.map(chat => {
            if (chat.id !== chatId) return chat;
            return {
                ...chat,
                messages: [],
                lastMessage: null,
                pinnedMessages: [] // Optionally clear pinned messages too? Yes, if messages are gone.
            };
        }));
    }, [setChats]);

    // Logic: Pin/Unpin Chat (Session Management)
    const pinChat = useCallback((chatId, isPinned) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, isPinned } : chat
        ));
    }, [setChats]);

    // Logic: Mark Chat as Unread (Session Management)
    const markChatUnread = useCallback((chatId, isUnread = true) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, isUnread } : chat
        ));
    }, [setChats]);

    // Logic: Set Chat Category (Session Management)
    const setChatCategory = useCallback((chatId, category) => {
        setChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, category } : chat
        ));
    }, [setChats]);

    // Logic: Pin/Unpin Message
    const pinMessage = useCallback((chatId, messageId, isPinned = true) => {
        setChats(prev => prev.map(chat => {
            if (chat.id !== chatId) return chat;
            const pinnedMessages = chat.pinnedMessages || [];
            if (isPinned && !pinnedMessages.includes(messageId)) {
                return { ...chat, pinnedMessages: [...pinnedMessages, messageId] };
            } else if (!isPinned) {
                return { ...chat, pinnedMessages: pinnedMessages.filter(id => id !== messageId) };
            }
            return chat;
        }));
    }, [setChats]);

    // Logic: Vote on Poll
    const votePoll = useCallback((chatId, pollId, optionId) => {
        setChats(prev => prev.map(chat => {
            if (chat.id !== chatId) return chat;
            const polls = chat.polls || [];
            const pollIndex = polls.findIndex(p => p.id === pollId);
            if (pollIndex === -1) return chat;

            const poll = { ...polls[pollIndex] };
            const userId = 'user-me'; // Currently only user votes this way

            // Handle voting logic
            if (poll.isMultiChoice) {
                // Toggle
                const newOptions = poll.options.map(opt => {
                    if (opt.id === optionId) {
                        const votes = opt.votes || [];
                        if (votes.includes(userId)) {
                            return { ...opt, votes: votes.filter(id => id !== userId) };
                        } else {
                            return { ...opt, votes: [...votes, userId] };
                        }
                    }
                    return opt;
                });
                poll.options = newOptions;

            } else {
                // Single choice - remove from others, add to this
                const newOptions = poll.options.map(opt => {
                    const votes = opt.votes || [];
                    if (opt.id === optionId) {
                        if (!votes.includes(userId)) {
                            return { ...opt, votes: [...votes, userId] };
                        }
                        return opt;
                    } else {
                        // Remove if exists
                        return { ...opt, votes: votes.filter(id => id !== userId) };
                    }
                });
                poll.options = newOptions;
            }

            const newPolls = [...polls];
            newPolls[pollIndex] = poll;
            return { ...chat, polls: newPolls };
        }));
    }, [setChats]);

    // Logic: Get Pinned Messages for a Chat
    const getPinnedMessages = useCallback((chatId) => {
        const chat = chats.find(c => c.id === chatId);
        if (!chat || !chat.pinnedMessages) return [];
        return chat.messages.filter(m => chat.pinnedMessages.includes(m.id));
    }, [chats]);



    // --- AI TOOL CALL MESSAGING SYSTEM ---
    // Queue system to prevent message overwrites
    const messageQueueRef = useRef([]);
    const isProcessingRef = useRef(false);

    // Helper: Calculate random delay within range
    const getRandomDelay = (delayConfig) => {
        const { min, max } = delayConfig;
        return min + Math.random() * (max - min);
    };

    // Helper: Calculate typing delay based on message length and typing speed
    const calculateTypingDelay = (messageLength, typingSpeed) => {
        const baseCharsPerSecond = {
            slow: 3,
            normal: 5,
            fast: 8
        };
        const charsPerSecond = baseCharsPerSecond[typingSpeed] || 5;
        return Math.min(3000, Math.max(500, (messageLength / charsPerSecond) * 1000));
    };

    // Helper: Clean ALL tool markers from message content
    const cleanMessageContent = (content) => {
        if (!content) return '';
        let cleaned = content;

        // Remove MULTI tags with all content (greedy within the tag)
        cleaned = cleaned.replace(/\[(?:MULTI|Multi|multi):[^\]]*\]/gi, '');

        // Remove SCHEDULE tags
        cleaned = cleaned.replace(/\[SCHEDULE:\s*\d+\s*\]/gi, '');

        // Handle REACT tags - extract just the emoji content
        cleaned = cleaned.replace(/\[REACT:\s*([^\]]*)\]/gi, (match, emoji) => {
            return emoji ? ` ${emoji.trim()}` : '';
        });

        // Remove SILENCE markers
        cleaned = cleaned.replace(/\[SILENCE\]/gi, '');

        // Remove reference patterns like [1], [2], [1][2], [R, etc.
        cleaned = cleaned.replace(/\[\d+\]/g, '');
        cleaned = cleaned.replace(/\[R\b/g, '');

        // Remove stray closing brackets (possibly orphaned)
        cleaned = cleaned.replace(/\]\]/g, ']');
        cleaned = cleaned.replace(/\]\s*$/g, '');

        // Transform GAME:Poll messages for AI context instead of removing them
        cleaned = cleaned.replace(/\[GAME:Poll:\s*(.+?)\]/gi, (match, question) => {
            return `[System: A poll has been created: "${question}". Please vote for an option.]`;
        });

        // Note: [POLL:ID] messages are kept as is, handled in context preparation


        // Remove any remaining [...] patterns that look like tool markers
        // Match patterns like [Something:...] or [WORD] where WORD is all caps
        cleaned = cleaned.replace(/\[[A-Z]+:[^\]]*\]/g, '');
        cleaned = cleaned.replace(/\[[A-Z]{2,}\]/g, '');

        // Clean up pipe characters that might be left over from MULTI parsing
        cleaned = cleaned.replace(/\s*\|\s*/g, ' ');

        // Clean up double or triple spaces
        cleaned = cleaned.replace(/\s{2,}/g, ' ');

        // Trim whitespace
        cleaned = cleaned.trim();

        return cleaned;
    };

    // Helper: Compress context for token optimization
    const compressContext = (messages, personas) => {
        if (messages.length <= 15) {
            return { compressed: false, messages };
        }

        const oldMessages = messages.slice(0, -8);
        const recentMessages = messages.slice(-8);

        const participants = new Set();
        const topics = [];

        oldMessages.forEach(msg => {
            if (msg.senderId !== 'user-me') {
                const persona = personas.find(p => p.id === msg.senderId);
                if (persona) participants.add(persona.name);
            }
            const words = msg.content.toLowerCase().split(/\s+/);
            words.forEach(word => {
                if (word.length > 5 && !['about', 'would', 'could', 'should', 'their', 'there', 'these', 'those'].includes(word)) {
                    if (!topics.includes(word) && topics.length < 5) {
                        topics.push(word);
                    }
                }
            });
        });

        const summary = `[Earlier conversation summary: ${oldMessages.length} messages between ${Array.from(participants).join(', ') || 'participants'}. Topics discussed: ${topics.join(', ') || 'general chat'}]`;

        return {
            compressed: true,
            summary,
            recentMessages
        };
    };

    // Process queue sequentially
    const processMessageQueue = useCallback(async () => {
        if (isProcessingRef.current || messageQueueRef.current.length === 0) return;

        isProcessingRef.current = true;

        while (messageQueueRef.current.length > 0) {
            const { chatId, content, senderId } = messageQueueRef.current.shift();

            setTypingIndicators(prev => {
                const newIndicators = { ...prev };
                if (newIndicators[chatId]) {
                    newIndicators[chatId] = newIndicators[chatId].filter(id => id !== senderId);
                    if (newIndicators[chatId].length === 0) delete newIndicators[chatId];
                }
                return newIndicators;
            });

            setChats(prevChats => prevChats.map(chat => {
                if (chat.id !== chatId) return chat;

                const newMessage = {
                    id: crypto.randomUUID(),
                    senderId,
                    content,
                    timestamp: new Date().toISOString(),
                    status: 'sent'
                };

                return {
                    ...chat,
                    messages: [...chat.messages, newMessage],
                    lastMessage: newMessage
                };
            }));

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        isProcessingRef.current = false;
    }, [setChats]);

    // Queue a message for sending - cleans content before storing
    const queueAIMessage = useCallback((chatId, content, senderId) => {
        const cleanedContent = cleanMessageContent(content);
        if (!cleanedContent) return; // Don't queue empty messages
        messageQueueRef.current.push({ chatId, content: cleanedContent, senderId });
        processMessageQueue();
    }, [processMessageQueue]);

    // Set typing indicator
    const setAITyping = useCallback((chatId, aiId, isTyping) => {
        setTypingIndicators(prev => {
            const chatTyping = prev[chatId] || [];
            if (isTyping && !chatTyping.includes(aiId)) {
                return { ...prev, [chatId]: [...chatTyping, aiId] };
            } else if (!isTyping) {
                const filtered = chatTyping.filter(id => id !== aiId);
                if (filtered.length === 0) {
                    const { [chatId]: _, ...rest } = prev;
                    return rest;
                }
                return { ...prev, [chatId]: filtered };
            }
            return prev;
        });
    }, []);

    // --- AI PROACTIVE MESSAGING TOOL ---
    // AI can decide to send a follow-up message later
    const scheduleProactiveMessage = useCallback(async (chatId, ai, delayMinutes) => {
        const key = `${chatId}-${ai.id}`;

        // Clear existing scheduled message for this AI in this chat
        if (scheduledMessagesRef.current.has(key)) {
            clearTimeout(scheduledMessagesRef.current.get(key));
        }

        const delayMs = delayMinutes * 60 * 1000;

        console.log(`[AI Proactive] ${ai.name} scheduled a message in ${delayMinutes} minutes`);

        const timeoutId = setTimeout(async () => {
            scheduledMessagesRef.current.delete(key);

            const currentChat = chatsRef.current.find(c => c.id === chatId);
            if (!currentChat) return;

            // Check if the last message is too recent (< 2 min), skip if so
            const lastMsg = currentChat.messages[currentChat.messages.length - 1];
            if (lastMsg) {
                const timeSinceLastMsg = Date.now() - new Date(lastMsg.timestamp).getTime();
                if (timeSinceLastMsg < 2 * 60 * 1000) {
                    console.log(`[AI Proactive] ${ai.name} skipped - conversation is active`);
                    return;
                }
            }

            // Show typing
            setAITyping(chatId, ai.id, true);

            // Prepare context
            const { compressed, summary, recentMessages } = compressContext(currentChat.messages, personas);
            const messagesToProcess = compressed ? recentMessages : currentChat.messages;

            const rawHistory = messagesToProcess.slice(-8).map(m => {
                const isUser = m.senderId === 'user-me';
                const sender = isUser ? 'User' : personas.find(p => p.id === m.senderId)?.name || 'Unknown';
                return {
                    role: isUser ? 'user' : 'assistant',
                    content: `${sender}: ${m.content}`
                };
            });

            const history = [];
            for (const msg of rawHistory) {
                if (history.length > 0 && history[history.length - 1].role === msg.role) {
                    history[history.length - 1].content += '\n' + msg.content;
                } else {
                    history.push({ ...msg });
                }
            }

            if (history.length > 0 && history[0].role === 'assistant') {
                history.unshift({ role: 'user', content: compressed ? summary : '[Previous chat context]' });
            }
            if (history.length > 0 && history[history.length - 1].role === 'assistant') {
                history.push({ role: 'user', content: '[Please respond]' });
            }

            const systemPrompt = `You are ${ai.name}.
Personality: ${ai.personality}
Style: ${ai.style}

The conversation has been quiet for a while. You're reaching out proactively.
Generate a natural follow-up message based on your personality:
- Could be sharing something interesting
- Could be checking in on them
- Could be continuing a previous topic
- Could be asking a question

Keep it short (1-2 sentences), natural, and in character.
DO NOT include your name prefix.
If you don't have anything to say, output [SILENCE].
`;

            const response = await callAI([
                { role: "system", content: systemPrompt },
                ...history
            ]);

            if (response && !response.includes('[SILENCE]')) {
                const typingDelay = calculateTypingDelay(response.length, ai.typingSpeed || 'normal');
                await new Promise(resolve => setTimeout(resolve, typingDelay));
                queueAIMessage(chatId, response, ai.id);
                console.log(`[AI Proactive] ${ai.name} sent proactive message`);
            } else {
                setAITyping(chatId, ai.id, false);
                console.log(`[AI Proactive] ${ai.name} decided not to send`);
            }
        }, delayMs);

        scheduledMessagesRef.current.set(key, timeoutId);
    }, [personas, queueAIMessage, setAITyping]);

    // Main message processing effect
    useEffect(() => {
        chats.forEach(chat => {
            if (!chat.messages.length) return;
            const lastMsg = chat.messages[chat.messages.length - 1];

            if (processedMessagesRef.current.has(lastMsg.id)) return;
            processedMessagesRef.current.add(lastMsg.id);

            let consecutiveAI = 0;
            for (let i = chat.messages.length - 1; i >= 0; i--) {
                const msg = chat.messages[i];
                if (msg.senderId === 'user-me') break;
                consecutiveAI++;
            }

            if (consecutiveAI >= 6) {
                console.log("Loop prevention active: Too many consecutive AI messages.");
                return;
            }

            const candidates = chat.participants
                .filter(id => id !== lastMsg.senderId)
                .map(id => personas.find(p => p.id === id))
                .filter(Boolean);

            if (candidates.length === 0) return;

            candidates.forEach((ai, index) => {
                const readDelay = getRandomDelay(ai.readDelay || { min: 500, max: 2000 });
                const responseDelay = getRandomDelay(ai.responseDelay || { min: 2000, max: 4000 });
                const staggerDelay = index * (800 + Math.random() * 400);
                const totalDelay = readDelay + staggerDelay;

                setTimeout(async () => {
                    const currentChat = chatsRef.current.find(c => c.id === chat.id);
                    if (!currentChat) return;

                    const isGroupChat = currentChat.participants.length > 2;
                    console.log(`[AI Tool] ${ai.name} processing in ${isGroupChat ? 'group' : 'single'} chat`);

                    setAITyping(chat.id, ai.id, true);

                    const { compressed, summary, recentMessages } = compressContext(currentChat.messages, personas);
                    const messagesToProcess = compressed ? recentMessages : currentChat.messages;

                    const rawHistory = messagesToProcess.slice(-12).map(m => {
                        const isUser = m.senderId === 'user-me';
                        const sender = isUser ? 'User' : personas.find(p => p.id === m.senderId)?.name || 'Unknown';

                        let content = m.content;
                        // Resolve Poll ID to content for AI
                        if (content.startsWith('[POLL:') && currentChat.polls) {
                            const pollMatch = content.match(/\[POLL:(.+?)\]/);
                            if (pollMatch) {
                                const poll = currentChat.polls.find(p => p.id === pollMatch[1]);
                                if (poll) {
                                    content = `[System: A poll has been created: "${poll.question}". Options: ${poll.options.map((o, i) => `${i + 1}. ${o.text}`).join(', ')}. Please vote.]`;
                                }
                            }
                        }

                        return {
                            role: isUser ? 'user' : 'assistant',
                            content: `${sender}: ${content}`
                        };
                    });

                    const history = [];
                    for (const msg of rawHistory) {
                        if (history.length > 0 && history[history.length - 1].role === msg.role) {
                            history[history.length - 1].content += '\n' + msg.content;
                        } else {
                            history.push({ ...msg });
                        }
                    }

                    if (history.length > 0 && history[0].role === 'assistant') {
                        history.unshift({ role: 'user', content: compressed ? summary : '[Previous chat context]' });
                    }
                    if (history.length > 0 && history[history.length - 1].role === 'assistant') {
                        history.push({ role: 'user', content: '[Please respond to the above conversation]' });
                    }

                    const perms = currentChat.permissions || { allowReactions: true, allowImages: false };

                    // Enhanced system prompt with multi-message capability
                    let systemPrompt;
                    if (isGroupChat) {
                        systemPrompt = `You are ${ai.name}.
Personality: ${ai.personality}
Style: ${ai.style}

You are in a GROUP CHAT.

AVAILABLE TOOLS:
1. SEND MESSAGE - Just respond normally
2. STAY SILENT - Output [SILENCE] to skip
3. MULTI MESSAGE - Use [MULTI:message1|message2|message3] to send multiple consecutive messages
   - Like real people, you can split your thoughts into 2-3 short messages
   - Example: [MULTI:哈哈好的|我等下就来|对了你吃饭了吗]
   - Use this naturally, not every time
4. SCHEDULE FOLLOWUP - Output [SCHEDULE:X] where X is minutes (5-60) to send a follow-up message later

${perms.allowReactions ? '- You can add [REACT:emoji] after your message.' : ''}

RULES:
- If the user greets → respond
- If mentioned → respond  
- If interesting topic → respond
- If a poll is created → respond by voting for an option (e.g., "I vote for option 1")
- If unrelated → [SILENCE]
- Keep each message short (1 sentence)
- Sometimes split long responses into multiple short messages using [MULTI:...]
`;
                    } else {
                        systemPrompt = `You are ${ai.name}.
Personality: ${ai.personality}
Style: ${ai.style}

You are having a 1-on-1 conversation.

AVAILABLE TOOLS:
1. SEND MESSAGE - Just respond normally
2. MULTI MESSAGE - Use [MULTI:message1|message2|message3] to send multiple consecutive messages
   - Like real people texting, you can split your thoughts into 2-3 short messages
   - Example: [MULTI:哈哈好的|我马上来|等我一下]
   - Use this naturally when you have multiple things to say
3. SCHEDULE FOLLOWUP - Output [SCHEDULE:X] where X is minutes (5-60) to send a follow-up later

${perms.allowReactions ? '- You can add [REACT:emoji] after your message.' : ''}

RULES:
- Always respond to the user
- Keep each message conversational and in character
- Use [MULTI:...] occasionally to seem more natural (like real texting)
- Keep individual messages short (1-2 sentences each)
`;
                    }

                    const response = await callAI([
                        { role: "system", content: systemPrompt },
                        ...history
                    ]);

                    if (response && !response.includes('[SILENCE]')) {
                        // Parse and handle SCHEDULE tool
                        const scheduleMatch = response.match(/\[SCHEDULE:(\d+)\]/);
                        let cleanResponse = response;

                        if (scheduleMatch) {
                            const scheduleMinutes = Math.min(60, Math.max(5, parseInt(scheduleMatch[1])));
                            cleanResponse = response.replace(scheduleMatch[0], '').trim();
                            scheduleProactiveMessage(chat.id, ai, scheduleMinutes);
                        }

                        // Parse and handle MULTI message tool (case-insensitive)
                        const multiMatch = cleanResponse.match(/\[(?:MULTI|Multi|multi):(.+?)\]/i);
                        if (multiMatch) {
                            const messages = multiMatch[1].split('|').map(m => m.trim()).filter(m => m);
                            cleanResponse = cleanResponse.replace(multiMatch[0], '').trim();

                            // Send multiple messages with natural delays between them
                            for (let i = 0; i < messages.length; i++) {
                                const msg = messages[i];
                                if (i === 0) {
                                    const typingDelay = calculateTypingDelay(msg.length, ai.typingSpeed || 'normal');
                                    await new Promise(resolve => setTimeout(resolve, typingDelay));
                                    queueAIMessage(chat.id, msg, ai.id);
                                } else {
                                    // Keep typing indicator and add delay between messages
                                    setAITyping(chat.id, ai.id, true);
                                    const delay = 800 + Math.random() * 1200; // 0.8-2s between messages
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                    const typingDelay = calculateTypingDelay(msg.length, ai.typingSpeed || 'normal');
                                    await new Promise(resolve => setTimeout(resolve, typingDelay));
                                    queueAIMessage(chat.id, msg, ai.id);
                                }
                            }

                            // If there's remaining content after MULTI, send it too
                            if (cleanResponse) {
                                setAITyping(chat.id, ai.id, true);
                                const delay = 500 + Math.random() * 800;
                                await new Promise(resolve => setTimeout(resolve, delay));
                                const typingDelay = calculateTypingDelay(cleanResponse.length, ai.typingSpeed || 'normal');
                                await new Promise(resolve => setTimeout(resolve, typingDelay));
                                queueAIMessage(chat.id, cleanResponse, ai.id);
                            }
                        } else if (cleanResponse) {
                            const typingDelay = calculateTypingDelay(cleanResponse.length, ai.typingSpeed || 'normal');
                            await new Promise(resolve => setTimeout(resolve, typingDelay));
                            queueAIMessage(chat.id, cleanResponse, ai.id);
                        } else {
                            setAITyping(chat.id, ai.id, false);
                        }
                    } else {
                        setAITyping(chat.id, ai.id, false);
                    }

                }, totalDelay + responseDelay);
            });
        });
    }, [chats, personas, queueAIMessage, setAITyping, scheduleProactiveMessage]);

    const value = {
        personas,
        chats,
        currentUser,
        sendMessage,
        createChat,
        updateChat,
        deleteChat,
        deleteMessage,
        clearChatMessages,
        typingIndicators,
        // Session Management
        pinChat,
        markChatUnread,
        setChatCategory,
        // Message Pinning
        pinMessage,
        getPinnedMessages,
        votePoll
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};

// Helper function to call any OpenAI-compatible API
async function callAI(messages) {
    const apiUrl = import.meta.env.VITE_AI_API_URL || 'https://api.perplexity.ai';
    const apiKey = import.meta.env.VITE_AI_API_KEY;
    const model = import.meta.env.VITE_AI_MODEL || 'llama-3.1-sonar-small-128k-chat';

    if (!apiKey) {
        console.error('AI API Key not configured. Set VITE_AI_API_KEY in .env');
        return null;
    }

    try {
        const response = await fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.8,
                max_tokens: 150
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error('API Error:', data.error);
            return null;
        }
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.trim();
        }
        return null;
    } catch (error) {
        console.error('API Call Failed:', error);
        return null;
    }
}
