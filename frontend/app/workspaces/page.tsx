"use client";

import { useEffect, useState } from "react";
import { fetchAuth } from "@/lib/api";
import { useRouter } from "next/navigation";
import { FolderPlus, Monitor, User } from "lucide-react";

interface Workspace {
    id: string;
    name: string;
    user_id: string;
    created_at: string;
}

export default function WorkspacesPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const router = useRouter();

    const loadWorkspaces = async () => {
        try {
            const res = await fetchAuth("/workspaces");
            const data = await res.json();
            setWorkspaces(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWorkspaces();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        try {
            setIsCreating(true);
            const res = await fetchAuth("/workspaces", {
                method: "POST",
                body: JSON.stringify({ name: newTitle }),
            });
            if (res.ok) {
                setNewTitle("");
                loadWorkspaces();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsCreating(false);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">AI Chat Workspaces</h1>
                    <div className="relative group">
                        <button className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shadow-lg hover:bg-indigo-700 transition-colors">
                            <User size={20} />
                        </button>
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl py-1 z-20 border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right">
                            <button
                                onClick={() => {
                                    localStorage.removeItem("token");
                                    router.push("/login");
                                }}
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                {/* Create New */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
                    <form onSubmit={handleCreate} className="flex gap-4">
                        <input
                            type="text"
                            placeholder="New Workspace Name..."
                            className="flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder-gray-500"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <FolderPlus size={20} />
                            Create
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workspaces.map((ws) => (
                        <button
                            key={ws.id}
                            onClick={() => router.push(`/workspaces/${ws.id}/chat`)}
                            className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow text-left border border-transparent hover:border-indigo-100 flex flex-col gap-4 group"
                        >
                            <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <Monitor size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">{ws.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    ID: {ws.id.slice(0, 8)}...
                                </p>
                            </div>
                        </button>
                    ))}

                    {workspaces.length === 0 && (
                        <div className="col-span-full text-center text-gray-500 py-12">
                            No workspaces found. Create one to get started!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
