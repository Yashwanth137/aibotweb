"use client";

import { useEffect, useState } from "react";
import { fetchAuth } from "@/lib/api";
import { useRouter } from "next/navigation";
import { FolderPlus, Monitor, User, Loader2 } from "lucide-react";

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100">
            {/* Minimal Header with Stronger Distinction */}
            <div className="w-full px-8 h-16 flex items-center justify-between border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm transition-all duration-200">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-tr from-indigo-700 to-violet-700 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                        <Monitor size={18} />
                    </div>
                    <span className="font-bold text-gray-900 tracking-tight">AIChat</span>
                </div>

                <div className="relative group">
                    <button className="w-9 h-9 rounded-full bg-gray-50 text-indigo-700 hover:bg-indigo-50 flex items-center justify-center transition-all shadow-sm ring-1 ring-gray-200 hover:ring-indigo-300">
                        <User size={18} />
                    </button>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl ring-1 ring-black/5 py-1 z-20 border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right">
                        <button
                            onClick={() => {
                                localStorage.removeItem("token");
                                router.push("/login");
                            }}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700 w-full text-left transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full px-8 pt-12 pb-20 max-w-[1920px] mx-auto">
                {/* Hero / Create Section */}
                <div className="text-center mb-16 relative">
                    {/* Ambient background glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none"></div>

                    <h1 className="text-4xl font-semibold text-gray-900 mb-3 tracking-tight">Welcome back</h1>
                    <p className="text-gray-500 mb-10 text-lg">Select a workspace or create a new one to get started.</p>

                    <form onSubmit={handleCreate} className="relative max-w-2xl mx-auto group z-0">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                placeholder="Name your new workspace..."
                                className="w-full pl-6 pr-36 py-5 bg-white border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none text-gray-900 placeholder-gray-400 text-lg transition-all duration-300 ease-out shadow-lg shadow-gray-200/50 group-hover:shadow-indigo-500/10"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                            />
                            <div className="absolute right-2.5">
                                <button
                                    type="submit"
                                    disabled={!newTitle.trim() || isCreating}
                                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2 font-medium text-sm transition-all duration-200 ease-out"
                                >
                                    {isCreating ? <Loader2 className="animate-spin" size={18} /> : <FolderPlus size={18} />}
                                    Create
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Workspace List */}
                <div className="space-y-6 max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Workspaces</h2>
                    </div>

                    {loading ? (
                        // Modern Skeleton Loader
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center gap-4 animate-pulse shadow-sm">
                                    <div className="h-12 w-12 bg-gray-200 rounded-xl"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-5 w-1/2 bg-gray-200 rounded"></div>
                                        <div className="h-3 w-1/4 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {workspaces.map((ws) => (
                                <button
                                    key={ws.id}
                                    onClick={() => router.push(`/workspaces/${ws.id}/chat`)}
                                    className="group bg-white p-6 rounded-2xl border border-gray-200 hover:border-indigo-500/50 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 ease-out text-left flex items-start gap-4 hover:-translate-y-1"
                                >
                                    <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm shrink-0">
                                        <Monitor size={22} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                                            {ws.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                {ws.id.slice(0, 4)}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(ws.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}

                            {workspaces.length === 0 && (
                                <div className="col-span-full py-24 text-center">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                                        <FolderPlus size={40} />
                                    </div>
                                    <h3 className="text-xl text-gray-900 font-medium mb-2">No workspaces yet</h3>
                                    <p className="text-gray-500">Create your first workspace above to get started.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
