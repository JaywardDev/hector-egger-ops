"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { Select } from "@/src/components/ui/select";
import { DurationInput, ProjectFilePicker } from "@/app/(protected)/production/components/entry-fields";
import { formatMinutesAsDuration } from "@/src/lib/production/format";
import type { ProductionDowntimeReasonRecord, ProductionInterruptionReasonRecord, ProductionOperatorOption, ProductionProjectFileRecord } from "@/src/lib/production/types";

type ReasonRow = { reasonId: string; durationMinutes: string };
type ReasonDraft = { reasonId: string; durationMinutes: number | null };
const toReasonDrafts = (rows?: ReasonRow[]): ReasonDraft[] =>
  (rows ?? []).map((row) => ({ reasonId: row.reasonId, durationMinutes: row.durationMinutes === "" ? null : Number(row.durationMinutes) }));
type Props = { formAction: (formData: FormData) => void | Promise<void>; submitLabel: string; operators: ProductionOperatorOption[]; canAssignOtherOperator: boolean; projectFiles: ProductionProjectFileRecord[]; downtimeReasons: ProductionDowntimeReasonRecord[]; interruptionReasons: ProductionInterruptionReasonRecord[]; latestTimeRemainingEndByProjectFile?: Record<string, number>; initialValues?: { entryId?: string; entryDate?: string; operatorProfileId?: string; projectFileId?: string; startTime?: string; finishTime?: string; timeRemainingStartMinutes?: number; timeRemainingEndMinutes?: number; actualVolumeCutM3?: number; runThroughBreak?: boolean; downtimeReasons?: ReasonRow[]; interruptionReasons?: ReasonRow[] } };
const parseTimeToMinutes = (time: string) => { const [hours, minutes] = time.split(":").map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.NaN; };
const ReasonRows = ({ kind, rows, setRows, reasons }: { kind: "downtime" | "interruption"; rows: ReasonDraft[]; setRows: (rows: ReasonDraft[]) => void; reasons: Array<{ id: string; label: string; is_active: boolean }> }) => (
  <div className="grid gap-2 rounded-md border border-zinc-200 p-3 sm:col-span-2">
    <div className="flex items-center justify-between gap-2"><p className="font-medium text-zinc-900">{kind === "downtime" ? "Downtime" : "Interruption"} reasons</p><Button type="button" variant="secondary" onClick={() => setRows([...rows, { reasonId: "", durationMinutes: null }])}>Add row</Button></div>
    <p className="text-xs text-zinc-500">Enter each duration as hours (e.g. 1.5) or HH:MM (e.g. 01:30).</p>
    {rows.length === 0 ? <p className="text-sm text-zinc-500">No rows added.</p> : null}
    {rows.map((row, index) => <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
      <Select name={`${kind}_reason_id`} value={row.reasonId} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, reasonId: event.currentTarget.value } : item))} required>
        <option value="">Select reason</option>{reasons.filter((reason) => reason.is_active || reason.id === row.reasonId).map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}
      </Select>
      <DurationInput name={`${kind}_duration_minutes`} ariaLabel="Duration in hours or HH:MM" valueMinutes={row.durationMinutes} onChangeMinutes={(minutes) => setRows(rows.map((item, i) => i === index ? { ...item, durationMinutes: minutes } : item))} required />
      <Button type="button" variant="secondary" onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remove</Button>
    </div>)}
  </div>
);

export function ProductionEntryForm({ formAction, submitLabel, operators, canAssignOtherOperator, projectFiles, downtimeReasons, interruptionReasons, latestTimeRemainingEndByProjectFile = {}, initialValues }: Props) {
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? ""); const [finishTime, setFinishTime] = useState(initialValues?.finishTime ?? "");
  const initialProjectFileId = initialValues?.projectFileId ?? "";
  const [projectFileId, setProjectFileId] = useState(initialProjectFileId);
  const initialTimeRemainingStart = initialValues?.timeRemainingStartMinutes ?? (initialValues?.entryId ? undefined : latestTimeRemainingEndByProjectFile[initialProjectFileId]);
  const [timeRemainingStart, setTimeRemainingStart] = useState<number | null>(initialTimeRemainingStart ?? null); const [timeRemainingEnd, setTimeRemainingEnd] = useState<number | null>(initialValues?.timeRemainingEndMinutes ?? 0);
  const [timeRemainingStartTouched, setTimeRemainingStartTouched] = useState(Boolean(initialValues?.entryId));
  const [downtimeRows, setDowntimeRows] = useState<ReasonDraft[]>(() => toReasonDrafts(initialValues?.downtimeReasons)); const [interruptionRows, setInterruptionRows] = useState<ReasonDraft[]>(() => toReasonDrafts(initialValues?.interruptionReasons));
  const warnings = useMemo(() => { const start = parseTimeToMinutes(startTime); const end = parseTimeToMinutes(finishTime); const operational = end - start; const downtime = downtimeRows.reduce((sum, row) => sum + (row.durationMinutes ?? 0), 0); const interruption = interruptionRows.reduce((sum, row) => sum + (row.durationMinutes ?? 0), 0); return { remainingMinutesIncreased: (timeRemainingEnd ?? 0) > (timeRemainingStart ?? 0), allocationExceedsOperational: Number.isFinite(operational) && operational >= 0 && downtime + interruption > operational, operational }; }, [downtimeRows, finishTime, interruptionRows, startTime, timeRemainingEnd, timeRemainingStart]);
  const activeProjectFiles = projectFiles.filter((project) => !project.is_archived || project.id === initialValues?.projectFileId);
  return <form action={formAction} className="grid gap-3 sm:grid-cols-2">
    {initialValues?.entryId ? <input type="hidden" name="entry_id" value={initialValues.entryId} /> : null}
    <FormField label="Date" htmlFor="entry_date"><Input id="entry_date" name="entry_date" type="date" defaultValue={initialValues?.entryDate ?? ""} required /></FormField>
    <FormField label="Operator" htmlFor="operator_profile_id"><Select id="operator_profile_id" name="operator_profile_id" defaultValue={initialValues?.operatorProfileId ?? ""} disabled={!canAssignOtherOperator} required>{operators.length === 0 ? <option value="">No operators available</option> : null}{operators.map((operator) => <option key={operator.profile_id} value={operator.profile_id}>{operator.display_name}</option>)}</Select></FormField>
    <FormField label="Project File" htmlFor="project_file_id"><ProjectFilePicker id="project_file_id" name="project_file_id" value={projectFileId} projectFiles={activeProjectFiles} onChange={(nextProjectFileId) => { setProjectFileId(nextProjectFileId); if (!timeRemainingStartTouched) setTimeRemainingStart(nextProjectFileId ? latestTimeRemainingEndByProjectFile[nextProjectFileId] ?? null : null); }} /></FormField>
    <FormField label="Start Time" htmlFor="start_time"><Input id="start_time" name="start_time" type="time" defaultValue={initialValues?.startTime ?? ""} onChange={(event) => setStartTime(event.currentTarget.value)} required /></FormField>
    <FormField label="Finish Time" htmlFor="finish_time"><Input id="finish_time" name="finish_time" type="time" defaultValue={initialValues?.finishTime ?? ""} onChange={(event) => setFinishTime(event.currentTarget.value)} required /></FormField>
    <FormField label="Operational Duration"><Input readOnly value={Number.isFinite(warnings.operational) && warnings.operational > 0 ? formatMinutesAsDuration(warnings.operational) : ""} /></FormField>
    <FormField label="Time Remaining Start" htmlFor="time_remaining_start_minutes" helperText="Hours (e.g. 1.5) or HH:MM (e.g. 125:30)"><DurationInput id="time_remaining_start_minutes" name="time_remaining_start_minutes" valueMinutes={timeRemainingStart} onChangeMinutes={(minutes) => { setTimeRemainingStartTouched(true); setTimeRemainingStart(minutes); }} required /></FormField>
    <FormField label="Time Remaining End" htmlFor="time_remaining_end_minutes" helperText="Hours (e.g. 1.5) or HH:MM (e.g. 125:30)"><DurationInput id="time_remaining_end_minutes" name="time_remaining_end_minutes" valueMinutes={timeRemainingEnd} onChangeMinutes={setTimeRemainingEnd} required /></FormField>
    <FormField label="Actual Volume Cut m³" htmlFor="actual_volume_cut_m3"><Input id="actual_volume_cut_m3" name="actual_volume_cut_m3" type="number" min={0} step="0.001" defaultValue={String(initialValues?.actualVolumeCutM3 ?? 0)} required /></FormField>
    <label className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2"><input name="run_through_break" type="checkbox" defaultChecked={initialValues?.runThroughBreak ?? false} /> Run Through Break</label>
    <ReasonRows kind="downtime" rows={downtimeRows} setRows={setDowntimeRows} reasons={downtimeReasons} />
    <ReasonRows kind="interruption" rows={interruptionRows} setRows={setInterruptionRows} reasons={interruptionReasons} />
    {warnings.remainingMinutesIncreased ? <Alert className="sm:col-span-2" variant="warning">Time Remaining End is greater than Time Remaining Start. Please confirm this is correct.</Alert> : null}
    {warnings.allocationExceedsOperational ? <Alert className="sm:col-span-2" variant="warning">Downtime and interruption exceed operational time. Please review the entry.</Alert> : null}
    {!canAssignOtherOperator && operators.length > 0 ? <input type="hidden" name="operator_profile_id" value={operators[0].profile_id} /> : null}
    <div className="sm:col-span-2"><PendingSubmitButton type="submit" disabled={operators.length === 0 || !projectFileId || timeRemainingStart === null || timeRemainingEnd === null} pendingLabel="Saving…">{submitLabel}</PendingSubmitButton></div>
  </form>;
}
