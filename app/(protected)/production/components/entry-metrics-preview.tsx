"use client";

import { useMemo, useState } from "react";
import { Card } from "@/src/components/ui/card";

const parseTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.NaN;
  }
  return hours * 60 + minutes;
};

export function EntryMetricsPreview() {
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [leftStart, setLeftStart] = useState(0);
  const [leftEnd, setLeftEnd] = useState(0);
  const [downtime, setDowntime] = useState(0);
  const [interruption, setInterruption] = useState(0);

  const metrics = useMemo(() => {
    const operationalMinutes = parseTimeToMinutes(end) - parseTimeToMinutes(start);
    const productiveMinutes = operationalMinutes - downtime;
    const projectFileDoneMinutes = leftStart - leftEnd;
    const machineEfficiencyPct =
      operationalMinutes <= 0
        ? null
        : (projectFileDoneMinutes - downtime) / operationalMinutes;
    const projectEfficiencyPct =
      operationalMinutes <= 0
        ? null
        : (projectFileDoneMinutes - downtime - interruption) / operationalMinutes;

    return {
      operationalMinutes,
      productiveMinutes,
      projectFileDoneMinutes,
      machineEfficiencyPct,
      projectEfficiencyPct,
    };
  }, [downtime, end, interruption, leftEnd, leftStart, start]);

  return (
    <Card>
      <p className="font-medium text-zinc-900">Computed preview</p>
      <p className="mt-1 text-xs text-zinc-500">
        Live preview to validate shift inputs before submit.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="space-y-1 text-xs">
          Shift start
          <input
            className="w-full rounded-md border border-zinc-200 px-2 py-1"
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs">
          Shift end
          <input
            className="w-full rounded-md border border-zinc-200 px-2 py-1"
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs">
          Minutes left start
          <input
            className="w-full rounded-md border border-zinc-200 px-2 py-1"
            type="number"
            min={0}
            value={leftStart}
            onChange={(event) => setLeftStart(Number(event.target.value) || 0)}
          />
        </label>
        <label className="space-y-1 text-xs">
          Minutes left end
          <input
            className="w-full rounded-md border border-zinc-200 px-2 py-1"
            type="number"
            min={0}
            value={leftEnd}
            onChange={(event) => setLeftEnd(Number(event.target.value) || 0)}
          />
        </label>
        <label className="space-y-1 text-xs">
          Downtime minutes
          <input
            className="w-full rounded-md border border-zinc-200 px-2 py-1"
            type="number"
            min={0}
            value={downtime}
            onChange={(event) => setDowntime(Number(event.target.value) || 0)}
          />
        </label>
        <label className="space-y-1 text-xs">
          Interruption minutes
          <input
            className="w-full rounded-md border border-zinc-200 px-2 py-1"
            type="number"
            min={0}
            value={interruption}
            onChange={(event) => setInterruption(Number(event.target.value) || 0)}
          />
        </label>
      </div>
      <div className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
        <p>Operational minutes: {metrics.operationalMinutes}</p>
        <p>Productive minutes: {metrics.productiveMinutes}</p>
        <p>Project file done minutes: {metrics.projectFileDoneMinutes}</p>
        <p>
          Machine efficiency: {metrics.machineEfficiencyPct === null ? "null" : `${(metrics.machineEfficiencyPct * 100).toFixed(1)}%`}
        </p>
        <p>
          Project efficiency: {metrics.projectEfficiencyPct === null ? "null" : `${(metrics.projectEfficiencyPct * 100).toFixed(1)}%`}
        </p>
      </div>
    </Card>
  );
}
