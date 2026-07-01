import "server-only";

import { requireProtectedAccess } from "@/src/lib/auth/guards";

// QA read-access seam.
//
// Per docs/qa-module-design.md §3, QA will get its *own* authorization model,
// isolated from user_roles/staff_group and driven one-way from the C-base
// export (job title → user role → per-project assignment). That model does not
// exist yet, so for this preview QA read access is simply "an approved,
// authenticated user" — the same bar as the other internal tools.
//
// When the real model lands, only this function (and the QA RLS helpers) change;
// the pages keep calling requireQaReadAccess and stay unaware of the mechanism.
export const requireQaReadAccess = async (route?: string) =>
  requireProtectedAccess(route);
