"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import type { ProductionDowntimeReasonRecord, ProductionInterruptionReasonRecord, ProductionOperatorOption, ProductionProjectFileRecord } from "@/src/lib/production/types";

type ReasonRow = { reasonId: string; durationMinutes: string };
type Props = { formAction: (formData: FormData) => void | Promise<void>; submitLabel: string; operators: ProductionOperatorOption[]; canAssignOtherOperator: boolean; projectFiles: ProductionProjectFileRecord[]; downtimeReasons: ProductionDowntimeReasonRecord[]; interruptionReasons: ProductionInterruptionReasonRecord[]; initialValues?: { entryId?: string; entryDate?: string; operatorProfileId?: string; projectFileId?: string; startTime?: string; finishTime?: string; timeRemainingStartMinutes?: number; timeRemainingEndMinutes?: number; actualVolumeCutM3?: number; runThroughBreak?: boolean; downtimeReasons?: ReasonRow[]; interruptionReasons?: ReasonRow[] } };
const parseTimeToMinutes = (time: string) => { const [hours, minutes] = time.split(":").map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.NaN; };
const ReasonRows = ({ kind, rows, setRows, reasons }: { kind: "downtime" | "interruption"; rows: ReasonRow[]; setRows: (rows: ReasonRow[]) => void; reasons: Array<{ id: string; label: string; is_active: boolean }> }) => (
  <div className="grid gap-2 rounded-md border border-zinc-200 p-3 sm:col-span-2">
    <div className="flex items-center justify-between gap-2"><p className="font-medium text-zinc-900">{kind === "downtime" ? "Downtime" : "Interruption"} reasons</p><Button type="button" variant="secondary" onClick={() => setRows([...rows, { reasonId: "", durationMinutes: "" }])}>Add row</Button></div>
    {rows.length === 0 ? <p className="text-sm text-zinc-500">No rows added.</p> : null}
    {rows.map((row, index) => <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
      <Select name={`${kind}_reason_id`} value={row.reasonId} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, reasonId: event.currentTarget.value } : item))} required>
        <option value="">Select reason</option>{reasons.filter((reason) => reason.is_active || reason.id === row.reasonId).map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}
      </Select>
      <Input name={`${kind}_duration_minutes`} type="number" min={1} value={row.durationMinutes} onChange={(event) => setRows(rows.map((item, i) => i === index ? { ...item, durationMinutes: event.currentTarget.value } : item))} required />
      <Button type="button" variant="secondary" onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remove</Button>
    </div>)}
  </div>
);

export function ProductionEntryForm({ formAction, submitLabel, operators, canAssignOtherOperator, projectFiles, downtimeReasons, interruptionReasons, initialValues }: Props) {
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? ""); const [finishTime, setFinishTime] = useState(initialValues?.finishTime ?? "");
  const [timeRemainingStart, setTimeRemainingStart] = useState(String(initialValues?.timeRemainingStartMinutes ?? 0)); const [timeRemainingEnd, setTimeRemainingEnd] = useState(String(initialValues?.timeRemainingEndMinutes ?? 0));
  const [downtimeRows, setDowntimeRows] = useState<ReasonRow[]>(initialValues?.downtimeReasons ?? []); const [interruptionRows, setInterruptionRows] = useState<ReasonRow[]>(initialValues?.interruptionReasons ?? []);
  const warnings = useMemo(() => { const start = parseTimeToMinutes(startTime); const end = parseTimeToMinutes(finishTime); const operational = end - start; const downtime = downtimeRows.reduce((sum, row) => sum + Number(row.durationMinutes || 0), 0); const interruption = interruptionRows.reduce((sum, row) => sum + Number(row.durationMinutes || 0), 0); return { remainingMinutesIncreased: Number(timeRemainingEnd) > Number(timeRemainingStart), allocationExceedsOperational: Number.isFinite(operational) && operational >= 0 && downtime + interruption > operational, operational }; }, [downtimeRows, finishTime, interruptionRows, startTime, timeRemainingEnd, timeRemainingStart]);
  const activeProjectFiles = projectFiles.filter((project) => !project.is_archived || project.id === initialValues?.projectFileId);
  return <form action={formAction} className="grid gap-3 sm:grid-cols-2">
    {initialValues?.entryId ? <input type="hidden" name="entry_id" value={initialValues.entryId} /> : null}
    <FormField label="Date" htmlFor="entry_date"><Input id="entry_date" name="entry_date" type="date" defaultValue={initialValues?.entryDate ?? ""} required /></FormField>
    <FormField label="Operator" htmlFor="operator_profile_id"><Select id="operator_profile_id" name="operator_profile_id" defaultValue={initialValues?.operatorProfileId ?? ""} disabled={!canAssignOtherOperator} required>{operators.length === 0 ? <option value="">No operators available</option> : null}{operators.map((operator) => <option key={operator.profile_id} value={operator.profile_id}>{operator.display_name}</option>)}</Select></FormField>
    <FormField label="Project File" htmlFor="project_file_id"><Select id="project_file_id" name="project_file_id" defaultValue={initialValues?.projectFileId ?? ""} required><option value="">Select project file</option>{activeProjectFiles.map((project) => <option key={project.id} value={project.id}>{project.project_name} — {project.project_file}{project.project_sequence === null ? "" : ` / Sequence ${project.project_sequence}`}</option>)}</Select></FormField>
    <FormField label="Start Time" htmlFor="start_time"><Input id="start_time" name="start_time" type="time" defaultValue={initialValues?.startTime ?? ""} onChange={(event) => setStartTime(event.currentTarget.value)} required /></FormField>
    <FormField label="Finish Time" htmlFor="finish_time"><Input id="finish_time" name="finish_time" type="time" defaultValue={initialValues?.finishTime ?? ""} onChange={(event) => setFinishTime(event.currentTarget.value)} required /></FormField>
    <FormField label="Operational Hours"><Input readOnly value={Number.isFinite(warnings.operational) && warnings.operational > 0 ? (warnings.operational / 60).toFixed(2) : ""} /></FormField>
    <FormField label="Time Remaining Start" htmlFor="time_remaining_start_minutes"><Input id="time_remaining_start_minutes" name="time_remaining_start_minutes" type="number" min={0} defaultValue={String(initialValues?.timeRemainingStartMinutes ?? 0)} onChange={(event) => setTimeRemainingStart(event.currentTarget.value)} required /></FormField>
    <FormField label="Time Remaining End" htmlFor="time_remaining_end_minutes"><Input id="time_remaining_end_minutes" name="time_remaining_end_minutes" type="number" min={0} defaultValue={String(initialValues?.timeRemainingEndMinutes ?? 0)} onChange={(event) => setTimeRemainingEnd(event.currentTarget.value)} required /></FormField>
    <FormField label="Actual Volume Cut m³" htmlFor="actual_volume_cut_m3"><Input id="actual_volume_cut_m3" name="actual_volume_cut_m3" type="number" min={0} step="0.001" defaultValue={String(initialValues?.actualVolumeCutM3 ?? 0)} required /></FormField>
    <label className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2"><input name="run_through_break" type="checkbox" defaultChecked={initialValues?.runThroughBreak ?? false} /> Run Through Break</label>
    <ReasonRows kind="downtime" rows={downtimeRows} setRows={setDowntimeRows} reasons={downtimeReasons} />
    <ReasonRows kind="interruption" rows={interruptionRows} setRows={setInterruptionRows} reasons={interruptionReasons} />
    {warnings.remainingMinutesIncreased ? <Alert className="sm:col-span-2" variant="warning">Time Remaining End is greater than Time Remaining Start. Please confirm this is correct.</Alert> : null}
    {warnings.allocationExceedsOperational ? <Alert className="sm:col-span-2" variant="warning">Downtime and interruption exceed operational time. Please review the entry.</Alert> : null}
    {!canAssignOtherOperator && operators.length > 0 ? <input type="hidden" name="operator_profile_id" value={operators[0].profile_id} /> : null}
    <div className="sm:col-span-2"><Button type="submit" disabled={operators.length === 0}>{submitLabel}</Button></div>
  </form>;
}
