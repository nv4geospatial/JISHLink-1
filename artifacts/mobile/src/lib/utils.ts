import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function statusLabel(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    present: { label: "Present", color: "bg-green-100 text-green-800" },
    late: { label: "Late", color: "bg-yellow-100 text-yellow-800" },
    early_out: { label: "Early Out", color: "bg-orange-100 text-orange-800" },
    absent: { label: "Absent", color: "bg-red-100 text-red-800" },
  };
  return map[status] ?? { label: status, color: "bg-gray-100 text-gray-700" };
}
