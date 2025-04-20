import { clsx, type ClassValue } from "clsx";
import React from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

export function useOutsideClick(
  ref: React.RefObject<any>,
  callback: any,
  deps?: any[]
) {
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        ref.current &&
        event.target &&
        !(event.target as Node).contains(ref.current)
      ) {
        callback();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, ...(deps ?? [])]);
}

export function formatByteSize(size: number): string {
  const units = ["b", "kb", "mb", "gb"];
  let unit = 0;
  while (size > 1024) {
    size /= 1024;
    unit++;
  }
  return size.toFixed(2) + units[unit];
}
