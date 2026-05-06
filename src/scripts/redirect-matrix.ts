import { hasPortalAccess, resolvePortalLanding, type OtpPortal } from "../../../frontend/src/utils/portal-auth";
import { resolveWorkspaceLandingPath } from "../../../frontend/src/utils/workspace-landing";

type WorkspaceRole = "customer" | "vendor" | "venue_owner" | "super_admin" | "vendor_admin" | "accounts_admin";

type RedirectCase = {
  name: string;
  portal: OtpPortal;
  permissions: string[];
  role?: WorkspaceRole;
  defaultLandingPath?: string;
  expectedHasAccess: boolean;
  expectedRedirectPath: string;
};

const cases: RedirectCase[] = [
  {
    name: "vendor portal with vendor permission",
    portal: "vendor",
    permissions: ["workspace:vendor:access"],
    role: "vendor",
    defaultLandingPath: "/vendor/bookings",
    expectedHasAccess: true,
    expectedRedirectPath: "/vendor",
  },
  {
    name: "venue-owner portal with venue-owner permission",
    portal: "venue-owner",
    permissions: ["workspace:venue-owner:access"],
    role: "venue_owner",
    defaultLandingPath: "/venue-owner/leads",
    expectedHasAccess: true,
    expectedRedirectPath: "/venue-owner",
  },
  {
    name: "admin portal with admin permission",
    portal: "admin",
    permissions: ["workspace:admin:access"],
    role: "super_admin",
    defaultLandingPath: "/admin/users",
    expectedHasAccess: true,
    expectedRedirectPath: "/admin",
  },
  {
    name: "user portal preserves allowed vendor default path",
    portal: "user",
    permissions: ["workspace:vendor:access"],
    role: "vendor",
    defaultLandingPath: "/vendor/bookings",
    expectedHasAccess: true,
    expectedRedirectPath: "/vendor/bookings",
  },
  {
    name: "user portal falls back to venue-owner when default path is unauthorized",
    portal: "user",
    permissions: ["workspace:venue-owner:access"],
    role: "venue_owner",
    defaultLandingPath: "/vendor/bookings",
    expectedHasAccess: true,
    expectedRedirectPath: "/venue-owner",
  },
  {
    name: "vendor portal denies non-vendor permission",
    portal: "vendor",
    permissions: ["workspace:venue-owner:access"],
    role: "venue_owner",
    defaultLandingPath: "/venue-owner",
    expectedHasAccess: false,
    expectedRedirectPath: "DENY",
  },
];

let failed = 0;

for (const item of cases) {
  const hasAccess = hasPortalAccess(item.portal, item.permissions);
  const fallbackLanding = resolveWorkspaceLandingPath(item.defaultLandingPath, item.permissions, item.role);
  const redirectPath = hasAccess ? resolvePortalLanding(item.portal, fallbackLanding) : "DENY";

  const passed = hasAccess === item.expectedHasAccess && redirectPath === item.expectedRedirectPath;

  if (!passed) {
    failed += 1;
    process.stderr.write(`[FAIL] ${item.name}\n`);
    process.stderr.write(
      `  expected access=${item.expectedHasAccess}, redirect=${item.expectedRedirectPath}\n`,
    );
    process.stderr.write(`  received access=${hasAccess}, redirect=${redirectPath}\n`);
  } else {
    process.stdout.write(`[PASS] ${item.name}\n`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
  process.stderr.write(`\nRedirect matrix failed with ${failed} case(s).\n`);
} else {
  process.stdout.write("\nRedirect matrix passed.\n");
}
