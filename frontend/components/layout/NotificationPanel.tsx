"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Bell,
    CheckCheck,
    FileCode,
    GraduationCap,
    Megaphone,
    Clock,
    X,
    ChevronRight,
    RefreshCw,
    Loader2,
    Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export interface Notification {
    id: string;
    user_id: string;
    type: "practical_assigned" | "submission_graded" | "deadline_reminder" | "announcement" | "submission_received";
    title: string;
    message: string | null;
    link: string | null;
    is_read: boolean;
    created_at: string;
    metadata: Record<string, any> | null;
}

const notificationIcons: Record<string, React.ReactNode> = {
    practical_assigned: <FileCode className="w-5 h-5 text-blue-500" />,
    submission_graded: <GraduationCap className="w-5 h-5 text-emerald-500" />,
    deadline_reminder: <Clock className="w-5 h-5 text-amber-500" />,
    announcement: <Megaphone className="w-5 h-5 text-purple-500" />,
    submission_received: <FileCode className="w-5 h-5 text-indigo-500" />,
};

const notificationColors: Record<string, string> = {
    practical_assigned: "bg-blue-100 dark:bg-blue-900/30",
    submission_graded: "bg-emerald-100 dark:bg-emerald-900/30",
    deadline_reminder: "bg-amber-100 dark:bg-amber-900/30",
    announcement: "bg-purple-100 dark:bg-purple-900/30",
    submission_received: "bg-indigo-100 dark:bg-indigo-900/30",
};

export default function NotificationPanel() {
    const supabase = useMemo(() => createClient(), []);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [grantingId, setGrantingId] = useState<string | null>(null);

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    // Fetch user
    useEffect(() => {
        const getUser = async () => {
            const { data } = await supabase.auth.getUser();
            if (data?.user) {
                setUserId(data.user.id);
            }
        };
        getUser();
    }, [supabase]);

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        if (!userId) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(20);

            if (error) {
                console.error("Failed to fetch notifications:", error);
                return;
            }

            setNotifications((data as unknown as Notification[]) || []);
        } catch (err) {
            console.error("Notification fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [supabase, userId]);

    useEffect(() => {
        if (userId) {
            fetchNotifications();
        }
    }, [userId, fetchNotifications]);

    // Real-time subscription
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel("notifications")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    setNotifications((prev) => [payload.new as unknown as Notification, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, userId]);

    // Mark single notification as read
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
            const res = await fetch(`/api/notifications?id=${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setNotifications((prev) => prev.filter((n) => n.id !== id));
            } else {
                const data = await res.json();
                console.error("Failed to delete notification:", data.error);
                alert(`Failed to delete: ${data.error}`);
            }
        } catch (err) {
            console.error("Delete notification error:", err);
            alert("An error occurred while deleting");
        }
    };

    // Format time
    const formatTime = (date: string) => {
        try {
            return formatDistanceToNow(new Date(date), { addSuffix: true });
        } catch {
            return "";
        }
    };

    // Handle Grant Re-attempt
    const handleGrantReattempt = async (notification: Notification) => {
        const meta = notification.metadata;
        if (!meta?.studentId || !meta?.practicalId) return;

        setGrantingId(notification.id);
        try {
            const res = await fetch('/api/faculty/allow-reattempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: meta.studentId,
                    practicalId: meta.practicalId
                })
            });
            if (res.ok) {
                // Mark as read and update notification
                await markAsRead(notification.id);
                alert('Re-attempt granted successfully!');
            } else {
                alert('Failed to grant re-attempt');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to grant re-attempt');
        } finally {
            setGrantingId(null);
        }
    };

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-scaleIn origin-top-right">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-indigo-500" />
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                    Notifications
                                </h3>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="p-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex items-center gap-1"
                                        title="Mark all as read"
                                    >
                                        <CheckCheck className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {loading ? (
                                <div className="p-6 space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex gap-3 animate-pulse">
                                            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                                                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                        <Bell className="w-7 h-7 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        No notifications yet
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        We'll notify you when something happens
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {notifications.map((notification) => {
                                        const isReattemptRequest = notification.metadata?.isReattemptRequest;

                                        return (
                                            <div
                                                key={notification.id}
                                                className={`group p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!notification.is_read
                                                    ? "bg-indigo-50/50 dark:bg-indigo-900/10"
                                                    : ""
                                                    } ${isReattemptRequest ? "border-l-4 border-purple-500" : ""}`}
                                                onClick={() => {
                                                    if (!notification.is_read && !isReattemptRequest) {
                                                        markAsRead(notification.id);
                                                    }
                                                    if (notification.link) {
                                                        setIsOpen(false);
                                                    }
                                                }}
                                            >
                                                <div className="flex gap-3">
                                                    <div
                                                        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isReattemptRequest
                                                            ? "bg-purple-100 dark:bg-purple-900/30"
                                                            : notificationColors[notification.type] || "bg-gray-100 dark:bg-gray-800"
                                                            }`}
                                                    >
                                                        {isReattemptRequest
                                                            ? <RefreshCw className="w-5 h-5 text-purple-500" />
                                                            : notificationIcons[notification.type] || <Bell className="w-5 h-5 text-gray-500" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p
                                                                className={`text-sm font-medium ${!notification.is_read
                                                                    ? "text-gray-900 dark:text-white"
                                                                    : "text-gray-700 dark:text-gray-300"
                                                                    }`}
                                                            >
                                                                {notification.title}
                                                            </p>
                                                            <div className="flex items-center gap-1">
                                                                {!notification.is_read && (
                                                                    <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                                                                )}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        deleteNotification(notification.id);
                                                                    }}
                                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Delete notification"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {notification.message && (
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                                {notification.message}
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                                            {formatTime(notification.created_at)}
                                                        </p>

                                                        {/* Grant Re-attempt Button */}
                                                        {isReattemptRequest && !notification.is_read && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleGrantReattempt(notification);
                                                                }}
                                                                disabled={grantingId === notification.id}
                                                                className="mt-2 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                                            >
                                                                {grantingId === notification.id ? (
                                                                    <><Loader2 className="w-3 h-3 animate-spin" /> Granting...</>
                                                                ) : (
                                                                    <><RefreshCw className="w-3 h-3" /> Grant Re-attempt</>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="border-t border-gray-100 dark:border-gray-800 p-2">
                                <Link
                                    href="/notifications"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-center gap-1 w-full py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                >
                                    View all notifications
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}


