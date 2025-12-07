"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Bell,
    Check,
    CheckCheck,
    FileCode,
    GraduationCap,
    Megaphone,
    Clock,
    Trash2,
    Filter,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Notification {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string | null;
    link: string | null;
    is_read: boolean;
    created_at: string;
    metadata: Record<string, any> | null;
}

const notificationIcons: Record<string, React.ReactNode> = {
    practical_assigned: <FileCode className="w-6 h-6 text-blue-500" />,
    submission_graded: <GraduationCap className="w-6 h-6 text-emerald-500" />,
    deadline_reminder: <Clock className="w-6 h-6 text-amber-500" />,
    announcement: <Megaphone className="w-6 h-6 text-purple-500" />,
    submission_received: <FileCode className="w-6 h-6 text-indigo-500" />,
};

const notificationColors: Record<string, string> = {
    practical_assigned: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800",
    submission_graded: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
    deadline_reminder: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
    announcement: "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800",
    submission_received: "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800",
};

export default function NotificationsPage() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "unread">("all");
    const [userId, setUserId] = useState<string | null>(null);

    // Check auth
    useEffect(() => {
        const checkUser = async () => {
            const { data } = await supabase.auth.getUser();
            if (!data?.user) {
                router.push("/auth/login");
                return;
            }
            setUserId(data.user.id);
        };
        checkUser();
    }, [supabase, router]);

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        if (!userId) return;

        setLoading(true);
        try {
            let query = supabase
                .from("notifications")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (filter === "unread") {
                query = query.eq("is_read", false);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Failed to fetch notifications:", error);
                return;
            }

            setNotifications(data || []);
        } catch (err) {
            console.error("Notification fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [supabase, userId, filter]);

    useEffect(() => {
        if (userId) {
            fetchNotifications();
        }
    }, [userId, filter, fetchNotifications]);

    // Mark single as read
    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("id", id);

            if (!error) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
                );
            }
        } catch (err) {
            console.error("Mark as read error:", err);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        if (!userId) return;

        try {
            const { error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("user_id", userId)
                .eq("is_read", false);

            if (!error) {
                setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            }
        } catch (err) {
            console.error("Mark all as read error:", err);
        }
    };

    // Delete notification
    const deleteNotification = async (id: string) => {
        try {
            const { error } = await supabase
                .from("notifications")
                .delete()
                .eq("id", id);

            if (!error) {
                setNotifications((prev) => prev.filter((n) => n.id !== id));
            }
        } catch (err) {
            console.error("Delete notification error:", err);
        }
    };

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">

            <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-slideUp">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                            <Bell className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gradient">Notifications</h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {unreadCount > 0
                                    ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                                    : "All caught up!"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Filter */}
                        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                            <button
                                onClick={() => setFilter("all")}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === "all"
                                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter("unread")}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filter === "unread"
                                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    }`}
                            >
                                Unread
                            </button>
                        </div>

                        {/* Mark all read */}
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
                            >
                                <CheckCheck className="w-4 h-4" />
                                Mark all read
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
                                        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                                        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="glass-card rounded-2xl p-12 text-center animate-fadeIn">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <Bell className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            {filter === "unread"
                                ? "You've read all your notifications!"
                                : "We'll notify you when something important happens."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {notifications.map((notification, index) => (
                            <div
                                key={notification.id}
                                className={`glass-card rounded-2xl p-5 hover-lift animate-slideUp border transition-all ${!notification.is_read
                                    ? "bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200/50 dark:border-indigo-800/30"
                                    : "border-transparent"
                                    }`}
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <div className="flex gap-4">
                                    {/* Icon */}
                                    <div
                                        className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${notificationColors[notification.type] || "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                            }`}
                                    >
                                        {notificationIcons[notification.type] || <Bell className="w-6 h-6 text-gray-500" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3
                                                    className={`font-semibold ${!notification.is_read
                                                        ? "text-gray-900 dark:text-white"
                                                        : "text-gray-700 dark:text-gray-300"
                                                        }`}
                                                >
                                                    {notification.title}
                                                </h3>
                                                {notification.message && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                        {notification.message}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                                    {format(new Date(notification.created_at), "MMM d, yyyy 'at' h:mm a")}
                                                    {" · "}
                                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1">
                                                {!notification.is_read && (
                                                    <button
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                        title="Mark as read"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteNotification(notification.id)}
                                                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Link */}
                                        {notification.link && (
                                            <Link
                                                href={notification.link}
                                                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                            >
                                                View details →
                                            </Link>
                                        )}
                                    </div>

                                    {/* Unread indicator */}
                                    {!notification.is_read && (
                                        <div className="flex-shrink-0">
                                            <span className="w-3 h-3 rounded-full bg-indigo-500 block animate-pulse" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
