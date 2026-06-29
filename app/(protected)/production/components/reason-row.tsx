"use client";

import { useEffect, useRef, useState } from "react";
import { updateProductionReasonFormAction } from "@/app/(protected)/production/actions";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { Select } from "@/src/components/ui/select";

type ReasonRowProps = {
  kind: "downtime" | "interruption";
  reason: { id: string; label: string; is_active: boolean };
};

// A managed reason: shows the label + status, with edit (inline label/status form)
// and activate/deactivate tucked into a three-dot menu to keep the list clean.
export function ReasonRow({ kind, reason }: ReasonRowProps) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (editing) {
    return (
      <form
        action={updateProductionReasonFormAction}
        className="flex flex-col gap-2 rounded-md border border-zinc-200 p-2 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="reason_id" value={reason.id} />
        <Input name="label" defaultValue={reason.label} required aria-label="Reason label" className="min-w-0 flex-1" />
        <Select name="is_active" defaultValue={reason.is_active ? "true" : "false"} aria-label="Reason status" className="w-full sm:w-auto">
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
        <div className="flex gap-2">
          <PendingSubmitButton type="submit" variant="secondary">
            Save
          </PendingSubmitButton>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 p-2">
      <span className="min-w-0 flex-1 break-words text-zinc-900">{reason.label}</span>
      <Badge variant={reason.is_active ? "success" : "muted"}>{reason.is_active ? "Active" : "Inactive"}</Badge>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label={`Actions for ${reason.label}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
          className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-lg leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
        >
          <span aria-hidden="true">⋯</span>
        </button>
        {menuOpen ? (
          <div role="menu" className="absolute right-0 top-10 z-20 min-w-36 rounded-md border border-zinc-200 bg-white py-1 text-left shadow-lg">
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
              onClick={() => {
                setEditing(true);
                setMenuOpen(false);
              }}
            >
              Edit
            </button>
            <form action={updateProductionReasonFormAction}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="reason_id" value={reason.id} />
              <input type="hidden" name="is_active" value={reason.is_active ? "false" : "true"} />
              <button type="submit" role="menuitem" className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                {reason.is_active ? "Deactivate" : "Activate"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
