import { ChartColumn, CircleCheck, Clock3, History, List, StickyNote, User } from "@/components/icons/lucide-react";
import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { AdminToolCard, AdminToolSection } from "./_components/admin-tool-card";

export default async function AdminPage() {
  await requireAdminAccess();

  return (
    <PageContainer>
      <PageHeader
        accent
        eyebrow="Administration"
        title="Admin workspace"
        description="Manage user access, keep C Base timesheet and QA data in sync, and generate operational exports."
      />

      <AdminToolSection title="Access">
        <AdminToolCard
          href="/admin/users"
          icon={User}
          title="User management"
          description="Review pending access requests, assign roles and staff groups, and manage approved or disabled accounts."
        />
      </AdminToolSection>

      <AdminToolSection title="Timesheets">
        <AdminToolCard
          href="/admin/timesheet-lookups"
          icon={List}
          title="Timesheet lookups"
          description="Browse synced projects and tasks with read-only filters, sorting, and pagination."
        />
        <AdminToolCard
          href="/admin/timesheet-lookups/import"
          icon={Clock3}
          tag="Import"
          title="C Base import"
          description="Validate and sync C Base BuildingsExport and CostcodesExport snapshots for timesheet projects and tasks."
        />
      </AdminToolSection>

      <AdminToolSection title="Quality assurance">
        <AdminToolCard
          href="/admin/qa-templates"
          icon={CircleCheck}
          title="QA checklist templates"
          description="Browse imported checklist templates and their versions, with recent import history."
        />
        <AdminToolCard
          href="/admin/qa-templates/import"
          icon={StickyNote}
          tag="Import"
          title="QA template import"
          description="Validate and version checklist templates from C-base. Append-only: a changed template creates a new version and never rewrites an existing one."
        />
      </AdminToolSection>

      <AdminToolSection title="Exports & payroll">
        <AdminToolCard
          href="/admin/stock-take-exports"
          icon={History}
          title="Stock take export history"
          description="Review a log of every stock take export that has been generated, including who exported it and when."
        />
        <AdminToolCard
          href="/admin/payroll-export"
          icon={ChartColumn}
          title="Payroll cutoff export"
          description="Generate weekly payroll cutoff XLSX exports for approved staff and approved timesheet statuses."
        />
      </AdminToolSection>
    </PageContainer>
  );
}
