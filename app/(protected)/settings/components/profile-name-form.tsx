"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileNameAction } from "@/app/(protected)/settings/actions";
import { Alert } from "@/src/components/ui/alert";
import { Input } from "@/src/components/ui/input";
import { PendingActionButton } from "@/src/components/ui/pending-button";

export function ProfileNameForm({
  firstName: initialFirstName,
  middleName: initialMiddleName,
  lastName: initialLastName,
}: {
  firstName: string;
  middleName: string;
  lastName: string;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [middleName, setMiddleName] = useState(initialMiddleName);
  const [lastName, setLastName] = useState(initialLastName);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    firstName !== initialFirstName ||
    middleName !== initialMiddleName ||
    lastName !== initialLastName;

  const save = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateProfileNameAction({ firstName, middleName, lastName });
      setFeedback({ type: result.ok ? "success" : "error", message: result.message });
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {feedback ? <Alert variant={feedback.type}>{feedback.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1 text-sm font-medium text-zinc-700">
          First name
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        </label>
        <label className="block space-y-1 text-sm font-medium text-zinc-700">
          Middle name <span className="font-normal text-zinc-400">(optional)</span>
          <Input value={middleName} onChange={(event) => setMiddleName(event.target.value)} />
        </label>
        <label className="block space-y-1 text-sm font-medium text-zinc-700">
          Last name
          <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </label>
      </div>
      <PendingActionButton
        type="button"
        onClick={save}
        isPending={isPending}
        disabled={!dirty || firstName.trim() === "" || lastName.trim() === ""}
        pendingLabel="Saving…"
      >
        Save name
      </PendingActionButton>
    </div>
  );
}
