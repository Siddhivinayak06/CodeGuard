interface StatusBadgeProps {
    status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    const styles: Record<string, string> = {
        submitted:
            "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
        graded:
            "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
        pending:
            "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
        rejected: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    };
    return (
        <span
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${styles[status.toLowerCase()] || styles.pending}`}
        >
            {status}
        </span>
    );
}
