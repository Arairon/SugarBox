import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(rawdate: string | number | Date, file = false) {
  const date = new Date(rawdate);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds();
  const d = date.getDate().toString().padStart(2, "0");
  const M = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear().toString().padStart(4, "0");
  if (file) return `${y}-${M}-${d}_${h}-${m}-${s}`;
  return `${h}:${m} ${y}-${M}-${d}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1000;
  const sizes = ['B', 'kB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

export function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

