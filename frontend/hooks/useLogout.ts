import { useLogoutContext } from "@/context/LogoutContext";

export function useLogout() {
  const { triggerLogout, isLoggingOut } = useLogoutContext();
  return { logout: triggerLogout, isLoggingOut };
}
