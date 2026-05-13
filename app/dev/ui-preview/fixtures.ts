export const mockUsers = [
  {
    id: "mock-user-001",
    name: "Amina Design",
    email: "amina.design@example.test",
    role: "Supervisor",
    status: "Approved",
    crew: "Factory A",
  },
  {
    id: "mock-user-002",
    name: "Noah Operator",
    email: "noah.operator@example.test",
    role: "Operator",
    status: "Pending",
    crew: "Site Crew 2",
  },
  {
    id: "mock-user-003",
    name: "Lina Admin",
    email: "lina.admin@example.test",
    role: "Admin",
    status: "Disabled",
    crew: "Office",
  },
] as const;

export const mockKpis = [
  { label: "Open approvals", value: "18", trend: "+4 today", tone: "warning" },
  { label: "Production entries", value: "126", trend: "92% complete", tone: "success" },
  { label: "Stock variances", value: "7", trend: "Needs review", tone: "danger" },
  { label: "Active projects", value: "14", trend: "3 high priority", tone: "info" },
] as const;

export const mockTimesheetRows = [
  {
    id: "mock-ts-1001",
    worker: "Amina Design",
    email: "amina.design@example.test",
    date: "2026-05-11",
    project: "Mock Project HE-2401",
    hours: "8.0",
    status: "Approved",
  },
  {
    id: "mock-ts-1002",
    worker: "Noah Operator",
    email: "noah.operator@example.test",
    date: "2026-05-11",
    project: "Mock Project HE-2418",
    hours: "6.5",
    status: "Submitted",
  },
  {
    id: "mock-ts-1003",
    worker: "Lina Admin",
    email: "lina.admin@example.test",
    date: "2026-05-10",
    project: "Mock Project HE-2422",
    hours: "4.0",
    status: "Draft",
  },
] as const;

export const mockApprovalRows = [
  {
    id: "mock-approval-2001",
    item: "Weekly timesheet batch",
    owner: "Factory A",
    submittedAt: "2026-05-12 08:15",
    risk: "Medium",
    state: "Ready",
  },
  {
    id: "mock-approval-2002",
    item: "Stock-take variance report",
    owner: "Warehouse",
    submittedAt: "2026-05-12 10:40",
    risk: "High",
    state: "Blocked",
  },
  {
    id: "mock-approval-2003",
    item: "Production import review",
    owner: "Site Crew 2",
    submittedAt: "2026-05-12 14:05",
    risk: "Low",
    state: "Queued",
  },
] as const;

export const mockProjectInventoryRows = [
  {
    id: "mock-inv-3001",
    code: "HE-MOCK-001",
    material: "Glulam beam sample",
    location: "Mock Yard A",
    project: "Mock Project HE-2401",
    quantity: "42 pcs",
  },
  {
    id: "mock-inv-3002",
    code: "HE-MOCK-002",
    material: "Fastener kit sample",
    location: "Mock Warehouse B",
    project: "Mock Project HE-2418",
    quantity: "18 boxes",
  },
  {
    id: "mock-inv-3003",
    code: "HE-MOCK-003",
    material: "Panel bundle sample",
    location: "Mock Loading Bay",
    project: "Mock Project HE-2422",
    quantity: "9 packs",
  },
] as const;
