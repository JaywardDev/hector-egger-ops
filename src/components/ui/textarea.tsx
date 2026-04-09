import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/src/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400",
        className,
      )}
      {...props}
    />
  );
}
