"use client";

import { useEffect, useState, useRef } from "react";
import { fetchAuth, getToken, API_BASE } from "@/lib/api";

import { useParams, useRouter } from "next/navigation";
import { Send, Plus, Bot, User, Loader2, Globe, Square, Trash2, Eraser } from "lucide-react";

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

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r flex flex-col">
                <div className="p-4 border-b">
                    <button
                        onClick={createChat}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {chats.map((chat) => (
                        <div key={chat.id} className="group/item flex items-center pr-2 relative">
                            <button
                                onClick={() => setSelectedChatId(chat.id)}
                                className={`flex-1 text-left p-3 rounded-md text-sm truncate ${selectedChatId === chat.id
                                    ? "bg-indigo-50 text-indigo-700 font-medium"
                                    : "text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                {chat.title || "Untitled Chat"}
                            </button>
                            <button
                                onClick={(e) => handleDeleteChat(e, chat.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded hidden group-hover/item:block transition-all"
                                title="Delete Chat"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t text-xs text-gray-400 text-center">
                    Workspace: {workspaceId ? String(workspaceId).slice(0, 8) : "..."}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="h-16 border-b bg-white flex items-center px-6 justify-between">
                    <h2 className="font-semibold text-gray-800">
                        {chats.find(c => c.id === selectedChatId)?.title || "Chat"}
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm ${useAgent ? "text-indigo-600 font-bold" : "text-gray-500"}`}>
                            Agent Mode
                        </span>
                        <button
                            onClick={() => setUseAgent(!useAgent)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useAgent ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useAgent ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        {selectedChatId && (
                            <button
                                onClick={handleClearChat}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors ml-2"
                                title="Clear Chat History"
                            >
                                <Eraser size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Bot size={48} className="mb-4 opacity-50" />
                            <p>Select a chat or start a new conversation.</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""
                                    }`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user"
                                        ? "bg-indigo-100 text-indigo-600"
                                        : "bg-green-100 text-green-600"
                                        }`}
                                >
                                    {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div
                                    className={`max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap ${msg.role === "user"
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white border shadow-sm text-gray-800"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t">
                    <form onSubmit={handleSend} className="relative max-w-4xl mx-auto">
                        <input
                            type="text"
                            className="w-full pl-4 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-gray-900 placeholder-gray-500"
                            placeholder={useAgent ? "Ask the agent (searches web)..." : "Message AI..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={streaming || !selectedChatId}
                        />
                        <button
                            type={streaming ? "button" : "submit"}
                            onClick={streaming ? handleStop : undefined}
                            disabled={!streaming && (!input.trim() || !selectedChatId)}
                            className={`absolute right-2 top-2 p-1.5 rounded-md text-white transition-colors ${streaming
                                ? "bg-red-500 hover:bg-red-600"
                                : "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-400"
                                }`}
                        >
                            {streaming ? <Square size={20} fill="currentColor" /> : <Send size={20} />}
                        </button>
                    </form>
                    <div className="text-center mt-2 text-xs text-gray-400 flex items-center justify-center gap-1">
                        {useAgent ? <><Globe size={12} /> Web Search Enabled</> : "Standard Model"}
                    </div>
                </div>
            </div>
        </div>
    );
}
