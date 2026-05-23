import Link from "next/link";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Card } from "@/src/components/ui/card";
import { getNzWeekEnd, getTodayNzDate } from "@/src/lib/dateTime";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { getPayrollExportData, type PayrollExportEmployeeRow } from "@/src/lib/timesheets/payroll-export";

type PayrollExportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getSearchParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const buildPreviewRows = (weekEnding: string, rows: PayrollExportEmployeeRow[]) => {
  const previewRows: Array<{ weekEnding: string; employeeName: string; totalHourWorked: number | ""; costCode: string; totalWorkedOnLeave: number | ""; descriptionChargeup: string; commentOther: string }> = [];
  for (const employee of rows) {
    previewRows.push({
      weekEnding,
      employeeName: employee.employeeName,
      totalHourWorked: employee.totalHourWorked,
      costCode: "",
      totalWorkedOnLeave: "",
      descriptionChargeup: employee.descriptionChargeup,
      commentOther: "",
    });
    for (const leave of employee.leaveRows) {
      previewRows.push({
        weekEnding,
        employeeName: "",
        totalHourWorked: "",
        costCode: leave.costCode,
        totalWorkedOnLeave: leave.leaveHours,
        descriptionChargeup: "",
        commentOther: leave.commentOther,
      });
    }
  }
  return previewRows;
};

export default async function PayrollExportPage({ searchParams }: PayrollExportPageProps) {
  const { session } = await requireAdminAccess();
  const resolvedSearchParams = (await searchParams) ?? {};
  const defaultWeekEnding = getNzWeekEnd(getTodayNzDate());
  const selectedWeekEnding = getSearchParam(resolvedSearchParams.weekEnding) ?? defaultWeekEnding;
  const isPreviewRequested = getSearchParam(resolvedSearchParams.preview) === "1";
  const previewData = isPreviewRequested ? await getPayrollExportData(session, selectedWeekEnding) : null;
  const previewRows = previewData ? buildPreviewRows(previewData.weekEnding, previewData.rows) : [];
  const totalPayrollHours = previewData ? Number(previewData.rows.reduce((total, row) => total + row.totalHourWorked, 0).toFixed(2)) : 0;
  const nonStandardHoursCount = previewData ? previewData.rows.filter((row) => Math.abs(row.totalHourWorked - 42.5) > 0.001).length : 0;

  return (
    <PageContainer>
      <PageHeader title="Payroll cutoff export" description="Export final-approved timesheets only as payroll cutoff summaries and leave detail rows in XLSX format." />
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-zinc-800" htmlFor="weekEnding">Payroll week ending</label>
          <input className="rounded-md border border-zinc-300 px-2 py-1 text-sm" id="weekEnding" name="weekEnding" type="date" defaultValue={selectedWeekEnding} form="payroll-export-form" />
          <form id="payroll-export-form" action="/admin/payroll-export/export" method="get">
            <button className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium" type="submit">Download XLSX</button>
          </form>
          <form action="/admin/payroll-export" method="get">
            <input name="weekEnding" type="hidden" value={selectedWeekEnding} />
            <input name="preview" type="hidden" value="1" />
            <button className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700" type="submit">Preview</button>
          </form>
        </div>
        <p className="mt-3 text-sm text-zinc-600">Only final-approved timesheets are payroll-ready and included in exports. Supervisor-reviewed entries are excluded until final approval. Back to <Link className="underline" href="/admin">admin tools</Link>.</p>
      </Card>
      {previewData ? (
        <>
          <Card>
            <h2 className="text-base font-semibold text-zinc-900">Preview summary</h2>
            <dl className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
              <div><dt className="font-medium text-zinc-900">Week ending</dt><dd>{previewData.displayWeekEnding}</dd></div>
              <div><dt className="font-medium text-zinc-900">Employee count</dt><dd>{previewData.rows.length}</dd></div>
              <div><dt className="font-medium text-zinc-900">Total export row count</dt><dd>{previewRows.length}</dd></div>
              <div><dt className="font-medium text-zinc-900">Total payroll hours</dt><dd>{totalPayrollHours}</dd></div>
              <div><dt className="font-medium text-zinc-900">Non-42.5 summary rows</dt><dd>{nonStandardHoursCount}</dd></div>
            </dl>
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-zinc-900">Preview rows</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border border-zinc-200 text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-700">
                  <tr>
                    <th className="border border-zinc-200 px-2 py-1">WEEK_ENDING</th><th className="border border-zinc-200 px-2 py-1">EMPLOYEE_NAME</th><th className="border border-zinc-200 px-2 py-1">TOTAL_HOUR_WORKED</th><th className="border border-zinc-200 px-2 py-1">COSTCODE</th><th className="border border-zinc-200 px-2 py-1">TOTAL_WORKED_ON_LEAVE</th><th className="border border-zinc-200 px-2 py-1">DESCRIPTION_CHARGEUP</th><th className="border border-zinc-200 px-2 py-1">COMMENT_OTHER</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={`${row.employeeName}-${row.costCode}-${index}`}>
                      <td className="border border-zinc-200 px-2 py-1">{row.weekEnding}</td><td className="border border-zinc-200 px-2 py-1">{row.employeeName}</td><td className="border border-zinc-200 px-2 py-1">{row.totalHourWorked}</td><td className="border border-zinc-200 px-2 py-1">{row.costCode}</td><td className="border border-zinc-200 px-2 py-1">{row.totalWorkedOnLeave}</td><td className="border border-zinc-200 px-2 py-1">{row.descriptionChargeup}</td><td className="border border-zinc-200 px-2 py-1">{row.commentOther}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </PageContainer>
  );
}
