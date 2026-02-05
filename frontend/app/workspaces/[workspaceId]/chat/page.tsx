"use client";

import { useEffect, useState, useRef } from "react";
import { fetchAuth, getToken, API_BASE } from "@/lib/api";

import { useParams, useRouter } from "next/navigation";
import { Send, Plus, Bot, User, Loader2, Globe, Square, Trash2, Eraser, Monitor } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Chat {
    id: string;
    title: string;
    created_at: string;
}

interface Message {
    id?: string;
    role: "user" | "assistant";
    content: string;
    created_at?: string;
}

export default function ChatPage() {
    const { workspaceId } = useParams();
    const router = useRouter();

    // State
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false); // Creating chat
    const [streaming, setStreaming] = useState(false); // Streaming response
    const [useAgent, setUseAgent] = useState(false); // Agent Toggle
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false); // Mobile Sidebar State

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load Chats
    useEffect(() => {
        if (workspaceId) {
            loadChats();
        }
    }, [workspaceId]);

    // Load Messages when chat selected
    useEffect(() => {
        if (selectedChatId) {
            loadMessages(selectedChatId);
            // Close mobile sidebar on selection
            setIsMobileSidebarOpen(false);
        } else {
            setMessages([]);
        }
    }, [selectedChatId]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streaming]);

    const loadChats = async () => {
        try {
            const res = await fetchAuth(`/chats?workspace_id=${workspaceId}`);
            const data = await res.json();
            setChats(data);
            if (data.length > 0 && !selectedChatId) {
                setSelectedChatId(data[0].id);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadMessages = async (chatId: string) => {
        try {
            const res = await fetchAuth(`/messages?chat_id=${chatId}`);
            const data = await res.json();
            setMessages(data);
        } catch (err) {
            console.error(err);
        }
    };

    const createChat = async () => {
        try {
            setLoading(true);
            const res = await fetchAuth("/chats", {
                method: "POST",
                body: JSON.stringify({ workspace_id: workspaceId, title: "New Chat" }),
            });
            const newChat = await res.json();
            setChats([newChat, ...chats]);
            setSelectedChatId(newChat.id);
            setIsMobileSidebarOpen(false); // Close sidebar on creation
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const abortControllerRef = useRef<AbortController | null>(null);

    const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this chat?")) return;
        try {
            await fetchAuth(`/chats/${chatId}`, { method: "DELETE" });
            setChats(chats.filter((c) => c.id !== chatId));
            if (selectedChatId === chatId) {
                setSelectedChatId(null);
                setMessages([]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleClearChat = async () => {
        if (!selectedChatId || !confirm("Clear all messages in this chat?")) return;
        try {
            await fetchAuth(`/chats/${selectedChatId}/clear`, { method: "POST" });
            setMessages([]);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !selectedChatId || streaming) return;

        const userMessage = input;
        setInput("");

        const tempUserMsg: Message = { role: "user", content: userMessage };
        setMessages((prev) => [...prev, tempUserMsg]);
        setStreaming(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const endpoint = useAgent ? "/chats/agent/stream" : "/chats/stream";
            const token = getToken();
            if (!token) {
                router.push("/login");
                return;
            }

            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    chat_id: selectedChatId,
                    message: userMessage
                }),
                signal: controller.signal
            });

            if (response.status === 401) {
                router.push("/login");
                return;
            }

            if (!response.ok || !response.body) {
                const text = await response.text();
                throw new Error(text || "Stream failed");
            }

            // Initialize Assistant Message
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let accumulatedContent = "";

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value, { stream: !done });
                accumulatedContent += chunkValue;

                setMessages((prev) => {
                    const newMsgs = [...prev];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg.role === "assistant") {
                        lastMsg.content = accumulatedContent;
                    }
                    return newMsgs;
                });
            }

        } catch (err: any) {
            if (err.name === "AbortError") {
                // Stream stopped by user
                setMessages((prev) => {
                    const newMsgs = [...prev];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg.role === "assistant") {
                        lastMsg.content += " [Stopped]";
                    }
                    return newMsgs;
                });
            } else {
                console.error(err);
                setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
            }
        } finally {
            setStreaming(false);
            abortControllerRef.current = null;
            // Refresh chats to check for auto-rename (new title)
            if (messages.length <= 1) { // checking if it was a new chat
                loadChats();
            }
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    // Sidebar Content Component for reuse
    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-gray-50/50">
            <div className="p-4">
                <div className="flex items-center justify-between mb-6 px-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            <Monitor size={18} />
                        </div>
                        <span className="font-semibold text-gray-900 tracking-tight">AIChat</span>
                    </div>
                </div>
                <button
                    onClick={createChat}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 px-4 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all duration-200 ease-in-out font-medium text-sm shadow-sm hover:shadow-md hover:shadow-indigo-500/10"
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    New Chat
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1">
                <div className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">History</div>
                {chats.map((chat) => (
                    <div key={chat.id} className="group/item flex items-center relative">
                        <button
                            onClick={() => setSelectedChatId(chat.id)}
                            className={`flex-1 text-left py-2.5 px-3 rounded-lg text-sm truncate transition-all duration-200 ease-in-out ${selectedChatId === chat.id
                                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100 font-medium"
                                : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                                }`}
                        >
                            {chat.title || "Untitled Chat"}
                        </button>
                        <button
                            onClick={(e) => handleDeleteChat(e, chat.id)}
                            className="absolute right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover/item:opacity-100 transition-all"
                            title="Delete Chat"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={() => router.push("/workspaces")}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <User size={18} />
                    <div className="flex flex-col items-start">
                        <span>User Account</span>
                        <span className="text-xs text-gray-400 font-normal">Workspace: {workspaceId?.toString().slice(0, 4)}...</span>
                    </div>
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-white">
            {/* Desktop Sidebar */}
            <div className="hidden md:flex w-72 bg-gray-50/50 border-r border-gray-100 flex-col shrink-0">
                <SidebarContent />
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsMobileSidebarOpen(false)}
                    />
                    {/* Drawer */}
                    <div className="absolute inset-y-0 left-0 w-[80%] max-w-xs bg-white shadow-2xl transform transition-transform duration-300 ease-in-out h-full border-r border-gray-100">
                        <SidebarContent />
                        {/* Close Button mobile only */}
                        <button
                            onClick={() => setIsMobileSidebarOpen(false)}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
                        >
                            {/* You can import 'X' from lucide-react if needed, or just let users click outside/select chat */}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-white min-w-0">
                {/* Header */}
                <div className="h-16 border-b border-gray-50 flex items-center px-4 md:px-8 justify-between shrink-0 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
                        </button>

                        <h2 className="font-semibold text-gray-900 text-lg truncate">
                            {chats.find(c => c.id === selectedChatId)?.title || "New Conversation"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 bg-gray-50/50 p-1 rounded-full border border-gray-100 shrink-0">
                        <button
                            onClick={() => setUseAgent(false)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!useAgent ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Standard
                        </button>
                        <button
                            onClick={() => setUseAgent(true)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${useAgent ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            <Globe size={12} />
                            <span className="hidden sm:inline">Agent Mode</span>
                            <span className="sm:hidden">Agent</span>
                        </button>
                    </div>
                    {/* Clear Button - hidden on small mobile if needed, or kept compact */}
                    {selectedChatId && (
                        <button
                            onClick={handleClearChat}
                            className="hidden sm:block ml-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                            title="Clear Chat History"
                        >
                            <Eraser size={18} />
                        </button>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto px-4">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-600">
                                <Bot size={32} />
                            </div>
                            <h3 className="text-xl font-medium text-gray-900 mb-2">How can I help you today?</h3>
                            <p className="text-gray-500 text-sm md:text-base">
                                Start a new conversation or toggle Agent Mode for web-connected answers.
                            </p>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex gap-3 md:gap-4 max-w-3xl mx-auto ${msg.role === "user" ? "flex-row-reverse" : ""
                                        }`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 ${msg.role === "user"
                                            ? "bg-gray-900 text-white"
                                            : "bg-indigo-600 text-white"
                                            }`}
                                    >
                                        {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div
                                        className={`max-w-[85%] md:max-w-[85%] p-3 md:p-4 rounded-2xl text-[14px] md:text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm border ${msg.role === "user"
                                            ? "bg-gray-50 border-gray-100 text-gray-900 rounded-tr-sm"
                                            : "bg-white border-gray-100 text-gray-800 rounded-tl-sm"
                                            }`}
                                    >
                                        {msg.role === "assistant" && !msg.content && streaming ? (
                                            <div className="flex space-x-1 items-center h-6 px-2">
                                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                            </div>
                                        ) : (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code({ node, className, children, ...props }) {
                                                        const match = /language-(\w+)/.exec(className || '')
                                                        const isInline = !match && !className?.includes('language-');
                                                        return !isInline ? (
                                                            <div className="rounded-md bg-gray-950 text-gray-50 border border-gray-800 my-4 overflow-hidden shadow-sm relative group/code max-w-full">
                                                                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-xs text-gray-400">
                                                                    <span>{match?.[1] || 'code'}</span>
                                                                </div>
                                                                <div className="p-3 overflow-x-auto text-sm font-mono leading-relaxed">
                                                                    <code className={className} {...props}>
                                                                        {children}
                                                                    </code>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <code className={`px-1.5 py-0.5 rounded font-mono text-sm ${msg.role === "user" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-800 border border-gray-200"}`} {...props}>
                                                                {children}
                                                            </code>
                                                        )
                                                    },
                                                    ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                                                    ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                                                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                                    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${msg.role === "user" ? "text-white hover:text-gray-100" : "text-indigo-600 hover:text-indigo-700"}`}>{children}</a>,
                                                    h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4">{children}</h1>,
                                                    h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
                                                    h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3">{children}</h3>,
                                                    blockquote: ({ children }) => <blockquote className={`border-l-4 pl-4 my-2 italic ${msg.role === "user" ? "border-white/40 text-gray-100" : "border-gray-200 text-gray-600"}`}>{children}</blockquote>,
                                                    table: ({ children }) => <div className="overflow-x-auto my-3"><table className={`min-w-full divide-y border rounded-lg ${msg.role === "user" ? "divide-white/20 border-white/20" : "divide-gray-200 border-gray-200"}`}>{children}</table></div>,
                                                    th: ({ children }) => <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider border-b ${msg.role === "user" ? "bg-white/10 text-white border-white/20" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{children}</th>,
                                                    td: ({ children }) => <td className={`px-3 py-2 whitespace-nowrap text-sm border-b ${msg.role === "user" ? "text-white border-white/10" : "text-gray-500 border-gray-100"}`}>{children}</td>,
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {/* Thinking Indicator Fallback */}
                            {streaming && messages[messages.length - 1]?.role === "user" && (
                                <div className="flex gap-4 max-w-3xl mx-auto">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 bg-indigo-600 text-white">
                                        <Bot size={16} />
                                    </div>
                                    <div className="max-w-[85%] p-4 rounded-2xl bg-white border border-gray-100 shadow-sm rounded-tl-sm">
                                        <div className="flex space-x-1 items-center h-6 px-2">
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 md:p-6 bg-white">
                    <form onSubmit={handleSend} className="relative max-w-3xl mx-auto">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                className="w-full pl-6 pr-14 py-3 md:py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm text-gray-900 placeholder-gray-400 transition-all duration-200 ease-in-out text-sm md:text-base"
                                placeholder={useAgent ? "Ask anything..." : "Message AI..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={streaming || !selectedChatId}
                            />
                            <button
                                type={streaming ? "button" : "submit"}
                                onClick={streaming ? handleStop : undefined}
                                disabled={!streaming && (!input.trim() || !selectedChatId)}
                                className={`absolute right-2 p-2 rounded-xl transition-all duration-200 ease-in-out ${streaming
                                    ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                                    : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:bg-indigo-600"
                                    }`}
                            >
                                {streaming ? <Square size={18} fill="currentColor" /> : <Send size={18} />}
                            </button>
                        </div>
                        <div className="mt-2 md:mt-3 text-center">
                            <span className="text-[10px] text-gray-400">AI can make mistakes. Check important info.</span>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
