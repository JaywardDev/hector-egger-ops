"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import type {
  ProductionDowntimeReasonRecord,
  ProductionInterruptionReasonRecord,
  ProductionOperatorOption,
  ProductionProjectRecord,
} from "@/src/lib/production/types";

type ProductionEntryFormProps = {
  formAction: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  operators: ProductionOperatorOption[];
  canAssignOtherOperator: boolean;
  projects: ProductionProjectRecord[];
  downtimeReasons: ProductionDowntimeReasonRecord[];
  interruptionReasons: ProductionInterruptionReasonRecord[];
  initialValues?: {
    entryId?: string;
    workDate?: string;
    operatorProfileId?: string;
    projectId?: string;
    shiftStartTime?: string;
    shiftEndTime?: string;
    fileMinutesLeftStart?: number;
    fileMinutesLeftEnd?: number;
    actualVolumeCutM3?: number;
    downtimeMinutes?: number;
    downtimeReasonId?: string | null;
    interruptionMinutes?: number;
    interruptionReasonId?: string | null;
    notes?: string | null;
  };
};

const parseTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.NaN;
  }
  return hours * 60 + minutes;
};

export function ProductionEntryForm({
  formAction,
  submitLabel,
  operators,
  canAssignOtherOperator,
  projects,
  downtimeReasons,
  interruptionReasons,
  initialValues,
}: ProductionEntryFormProps) {
  const [shiftStartTime, setShiftStartTime] = useState(initialValues?.shiftStartTime ?? "");
  const [shiftEndTime, setShiftEndTime] = useState(initialValues?.shiftEndTime ?? "");
  const [fileMinutesLeftStart, setFileMinutesLeftStart] = useState(
    String(initialValues?.fileMinutesLeftStart ?? 0),
  );
  const [fileMinutesLeftEnd, setFileMinutesLeftEnd] = useState(
    String(initialValues?.fileMinutesLeftEnd ?? 0),
  );
  const [downtimeMinutes, setDowntimeMinutes] = useState(
    String(initialValues?.downtimeMinutes ?? 0),
  );
  const [interruptionMinutes, setInterruptionMinutes] = useState(
    String(initialValues?.interruptionMinutes ?? 0),
  );

  const warnings = useMemo(() => {
    const leftStart = Number(fileMinutesLeftStart);
    const leftEnd = Number(fileMinutesLeftEnd);
    const downtime = Number(downtimeMinutes);
    const interruption = Number(interruptionMinutes);

    const start = parseTimeToMinutes(shiftStartTime);
    const end = parseTimeToMinutes(shiftEndTime);
    const operational = end - start;

    return {
      remainingMinutesIncreased:
        Number.isFinite(leftStart) && Number.isFinite(leftEnd) && leftEnd > leftStart,
      allocationExceedsOperational:
        Number.isFinite(downtime) &&
        Number.isFinite(interruption) &&
        Number.isFinite(operational) &&
        operational >= 0 &&
        downtime + interruption > operational,
    };
  }, [downtimeMinutes, fileMinutesLeftEnd, fileMinutesLeftStart, interruptionMinutes, shiftEndTime, shiftStartTime]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {initialValues?.entryId ? <input type="hidden" name="entry_id" value={initialValues.entryId} /> : null}
      <FormField label="Work date" htmlFor="work_date">
        <Input id="work_date" name="work_date" type="date" defaultValue={initialValues?.workDate ?? ""} required />
      </FormField>
      <FormField label="Operator" htmlFor="operator_profile_id">
        <Select
          id="operator_profile_id"
          name="operator_profile_id"
          defaultValue={initialValues?.operatorProfileId ?? ""}
          disabled={!canAssignOtherOperator}
          required
        >
          {operators.length === 0 ? <option value="">No operators available</option> : null}
          {operators.map((operator) => (
            <option key={operator.profile_id} value={operator.profile_id}>
              {operator.display_name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Project" htmlFor="project_id">
        <Select id="project_id" name="project_id" defaultValue={initialValues?.projectId ?? ""} required>
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.project_file} #{project.project_sequence} · {project.project_name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Shift start" htmlFor="shift_start_time">
        <Input
          id="shift_start_time"
          name="shift_start_time"
          type="time"
          defaultValue={initialValues?.shiftStartTime ?? ""}
          onChange={(event) => setShiftStartTime(event.currentTarget.value)}
          required
        />
      </FormField>
      <FormField label="Shift end" htmlFor="shift_end_time">
        <Input
          id="shift_end_time"
          name="shift_end_time"
          type="time"
          defaultValue={initialValues?.shiftEndTime ?? ""}
          onChange={(event) => setShiftEndTime(event.currentTarget.value)}
          required
        />
      </FormField>
      <FormField label="File minutes left start" htmlFor="file_minutes_left_start">
        <Input
          id="file_minutes_left_start"
          name="file_minutes_left_start"
          type="number"
          min={0}
          defaultValue={String(initialValues?.fileMinutesLeftStart ?? 0)}
          onChange={(event) => setFileMinutesLeftStart(event.currentTarget.value)}
          required
        />
      </FormField>
      <FormField label="File minutes left end" htmlFor="file_minutes_left_end">
        <Input
          id="file_minutes_left_end"
          name="file_minutes_left_end"
          type="number"
          min={0}
          defaultValue={String(initialValues?.fileMinutesLeftEnd ?? 0)}
          onChange={(event) => setFileMinutesLeftEnd(event.currentTarget.value)}
          required
        />
      </FormField>
      <FormField label="Actual volume cut m³" htmlFor="actual_volume_cut_m3">
        <Input
          id="actual_volume_cut_m3"
          name="actual_volume_cut_m3"
          type="number"
          min={0}
          step="0.001"
          defaultValue={String(initialValues?.actualVolumeCutM3 ?? 0)}
        />
      </FormField>
      <FormField label="Downtime minutes" htmlFor="downtime_minutes">
        <Input
          id="downtime_minutes"
          name="downtime_minutes"
          type="number"
          min={0}
          defaultValue={String(initialValues?.downtimeMinutes ?? 0)}
          onChange={(event) => setDowntimeMinutes(event.currentTarget.value)}
        />
      </FormField>
      <FormField label="Downtime reason" htmlFor="downtime_reason_id">
        <Select
          id="downtime_reason_id"
          name="downtime_reason_id"
          defaultValue={initialValues?.downtimeReasonId ?? ""}
        >
          <option value="">None</option>
          {downtimeReasons.map((reason) => (
            <option key={reason.id} value={reason.id}>
              {reason.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Interruption minutes" htmlFor="interruption_minutes">
        <Input
          id="interruption_minutes"
          name="interruption_minutes"
          type="number"
          min={0}
          defaultValue={String(initialValues?.interruptionMinutes ?? 0)}
          onChange={(event) => setInterruptionMinutes(event.currentTarget.value)}
        />
      </FormField>
      <FormField label="Interruption reason" htmlFor="interruption_reason_id">
        <Select
          id="interruption_reason_id"
          name="interruption_reason_id"
          defaultValue={initialValues?.interruptionReasonId ?? ""}
        >
          <option value="">None</option>
          {interruptionReasons.map((reason) => (
            <option key={reason.id} value={reason.id}>
              {reason.label}
            </option>
          ))}
        </Select>
      </FormField>
      {warnings.remainingMinutesIncreased ? (
        <Alert className="sm:col-span-2" variant="warning">
          Remaining file minutes increased during this shift. Please confirm this is correct.
        </Alert>
      ) : null}
      {warnings.allocationExceedsOperational ? (
        <Alert className="sm:col-span-2" variant="warning">
          Downtime and interruption exceed the shift&apos;s operational time. Please review the entry.
        </Alert>
      ) : null}
      <FormField className="sm:col-span-2" label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={4} defaultValue={initialValues?.notes ?? ""} />
      </FormField>
      {!canAssignOtherOperator && operators.length > 0 ? (
        <input type="hidden" name="operator_profile_id" value={operators[0].profile_id} />
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={operators.length === 0}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
