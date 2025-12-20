"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import {
    User as UserIcon,
    Mail,
    Shield,
    Key,
    GraduationCap,
    Save,
    Loader2,
    Camera,
    CheckCircle2,
    AlertCircle
} from "lucide-react";

export default function ProfilePage() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "student",
        semester: "", // Only for students
    });

    const [passwordData, setPasswordData] = useState({
        newPassword: "",
        confirmPassword: "",
    });

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    router.push("/auth/login");
                    return;
                }

                setUser(user);

                // Fetch user metadata/profile from DB
                const { data: profile } = await supabase
                    .from("users")
                    .select("name, role")
                    .eq("uid", user.id)
                    .single();

                let studentSemester = "";
                if (profile?.role === "student") {
                    const { data: student } = await supabase
                        .from("student_details")
                        .select("semester")
                        .eq("student_id", user.id)
                        .single();
                    if (student) studentSemester = student.semester.toString();
                }

                setFormData({
                    name: profile?.name || user.user_metadata?.full_name || "",
                    email: user.email || "",
                    role: profile?.role || user.user_metadata?.role || "student",
                    semester: studentSemester,
                });

            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [supabase, router]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            if (!user) return;

            // Update public.users
            const { error: userError } = await supabase
                .from("users")
                .update({ name: formData.name })
                .eq("uid", user.id);

            if (userError) throw userError;

            // If student, update semester
            if (formData.role === "student" && formData.semester) {
                const { error: studentError } = await supabase
                    .from("student_details")
                    .update({ semester: parseInt(formData.semester) })
                    .eq("student_id", user.id);

                if (studentError) throw studentError;
            }

            setMessage({ type: "success", text: "Profile updated successfully!" });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to update profile." });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match." });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setMessage({ type: "error", text: "Password must be at least 6 characters." });
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            });

            if (error) throw error;

            setMessage({ type: "success", text: "Password updated successfully!" });
            setPasswordData({ newPassword: "", confirmPassword: "" });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to update password." });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">

            <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 animate-slideUp">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Profile Settings</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your account settings and preferences.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* User Card */}
                    <div className="lg:col-span-1 space-y-6 animate-slideUp">
                        <div className="glass-card-premium rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-20" />
                            <div className="relative mt-8">
                                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-1 mb-4 shadow-xl">
                                    <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-purple-600">
                                        {formData.name.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                <button className="absolute bottom-4 right-0 p-2 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors">
                                    <Camera size={16} />
                                </button>
                            </div>

                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{formData.name}</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{formData.email}</p>

                            <div className="flex flex-wrap justify-center gap-2">
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 uppercase">
                                    {formData.role}
                                </span>
                                {formData.role === "student" && formData.semester && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                                        Sem {formData.semester}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Account Status */}
                        <div className="glass-card rounded-3xl p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-emerald-500" />
                                Account Status
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-sm font-medium text-emerald-900 dark:text-emerald-300">Email Verified</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 px-2">
                                    <span>Member since</span>
                                    <span className="font-medium text-gray-900 dark:text-white">Dec 2023</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Edit Forms */}
                    <div className="lg:col-span-2 space-y-6 animate-slideUp animation-delay-100">
                        {message && (
                            <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                                }`}>
                                {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                                {message.text}
                            </div>
                        )}

                        {/* Personal Details Form */}
                        <div className="glass-card rounded-3xl p-8">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-indigo-500" />
                                Personal Information
                            </h3>
                            <form onSubmit={handleUpdateProfile} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                        <div className="relative">
                                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 outline-none transition-all"
                                                placeholder="John Doe"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="email"
                                                value={formData.email}
                                                disabled
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed outline-none"
                                            />
                                        </div>
                                    </div>

                                    {formData.role === "student" && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
                                            <div className="relative">
                                                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="number"
                                                    value={formData.semester}
                                                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 outline-none transition-all"
                                                    placeholder="e.g. 5"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Security Section */}
                        <div className="glass-card rounded-3xl p-8">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Key className="w-5 h-5 text-indigo-500" />
                                Security
                            </h3>
                            <form onSubmit={handleChangePassword} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                                        <input
                                            type="password"
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 outline-none transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                                        <input
                                            type="password"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 outline-none transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
