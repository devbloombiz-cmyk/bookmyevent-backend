type OtpPortal = "user" | "vendor" | "venue-owner" | "admin";

type WorkspaceRole = "customer" | "vendor" | "venue_owner" | "super_admin" | "vendor_admin" | "accounts_admin";

const ADMIN_ACCESS = "workspace:admin:access";
const VENDOR_ACCESS = "workspace:vendor:access";
const VENUE_OWNER_ACCESS = "workspace:venue-owner:access";
const CUSTOMER_ACCESS = "workspace:customer:access";

function hasPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function normalizePath(path?: string) {
  const value = (path || "").trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "";
  }

  return value;
}

function roleFallbackPath(role?: WorkspaceRole) {
  if (role === "super_admin" || role === "vendor_admin" || role === "accounts_admin") {
    return "/admin";
  }

  if (role === "vendor") {
    return "/vendor";
  }

  if (role === "venue_owner") {
    return "/venue-owner";
  }

  return "/";
}

function isAllowedByPermissions(path: string, permissions: string[]) {
  if (hasPrefix(path, "/admin")) {
    return permissions.includes(ADMIN_ACCESS);
  }

  if (hasPrefix(path, "/vendor")) {
    return permissions.includes(VENDOR_ACCESS);
  }

  if (hasPrefix(path, "/venue-owner")) {
    return permissions.includes(VENUE_OWNER_ACCESS);
  }

  return true;
}

function resolveWorkspaceLandingPath(
  defaultLandingPath: string | undefined,
  permissions: string[],
  role?: WorkspaceRole,
) {
  const normalizedDefault = normalizePath(defaultLandingPath);

  if (normalizedDefault && isAllowedByPermissions(normalizedDefault, permissions)) {
    return normalizedDefault;
  }

  if (permissions.includes(ADMIN_ACCESS)) {
    return "/admin";
  }

  if (permissions.includes(VENDOR_ACCESS)) {
    return "/vendor";
  }

  if (permissions.includes(VENUE_OWNER_ACCESS)) {
    return "/venue-owner";
  }

  if (permissions.includes(CUSTOMER_ACCESS)) {
    return "/";
  }

  return roleFallbackPath(role);
}

function hasPortalAccess(portal: OtpPortal, permissions: string[]) {
  if (portal === "vendor") {
    return permissions.includes(VENDOR_ACCESS);
  }

  if (portal === "venue-owner") {
    return permissions.includes(VENUE_OWNER_ACCESS);
  }

  if (portal === "admin") {
    return permissions.includes(ADMIN_ACCESS);
  }

  return true;
}

function resolvePortalLanding(portal: OtpPortal, fallbackPath: string) {
  if (portal === "vendor") {
    return "/vendor";
  }

  if (portal === "venue-owner") {
    return "/venue-owner";
  }

  if (portal === "admin") {
    return "/admin";
  }

  return fallbackPath;
}

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
