import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the URL for the current environment.
 * Prioritizes window.location.origin for client-side consistency,
 * ensuring simpler dev/prod parity.
 */
export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    "http://localhost:3000/";

  // Make sure to include `https://` when not localhost.
  url = url.includes("http") ? url : `https://${url}`;

  // Make sure to include a trailing `/`.
  url = url.charAt(url.length - 1) === "/" ? url : `${url}/`;

  // If we're client-side, window.location is the MOST reliable source of truth
  // for the current origin, unless we have very specific proxy needs.
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return url;
};
