import { AlertTriangle, CheckCircle, Smartphone } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ConflictAlertProps {
  conflict?: { conflict: boolean; reason?: string };
}

export function ConflictAlert({ conflict }: ConflictAlertProps) {
  if (!conflict) return null;

  if (conflict.conflict) {
    return (
      <Alert
        variant="destructive"
        className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900"
      >
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Conflict Detected</AlertTitle>
        <AlertDescription>
          {conflict.reason || "This slot is not available."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900 text-green-800 dark:text-green-300">
      <CheckCircle className="h-4 w-4 stroke-green-600 dark:stroke-green-400" />
      <AlertTitle>Available</AlertTitle>
      <AlertDescription>
        This slot is available for scheduling.
      </AlertDescription>
    </Alert>
  );
}
