import { fileURLToPath } from "node:url";

export const serviceSchemas = [
  {
    name: "tenant-registry",
    database: "tenant_registry",
    schema: "prisma/tenant-registry/schema.prisma",
    envVar: "TENANT_REGISTRY_DATABASE_URL",
  },
  {
    name: "identity-access",
    database: "identity_access",
    schema: "prisma/identity-access/schema.prisma",
    envVar: "IDENTITY_ACCESS_DATABASE_URL",
  },
  {
    name: "academics",
    database: "academics",
    schema: "prisma/academics/schema.prisma",
    envVar: "ACADEMICS_DATABASE_URL",
  },
  {
    name: "admissions",
    database: "admissions",
    schema: "prisma/admissions/schema.prisma",
    envVar: "ADMISSIONS_DATABASE_URL",
  },
  {
    name: "registrar",
    database: "registrar",
    schema: "prisma/registrar/schema.prisma",
    envVar: "REGISTRAR_DATABASE_URL",
  },
  {
    name: "alumni",
    database: "alumni",
    schema: "prisma/alumni/schema.prisma",
    envVar: "ALUMNI_DATABASE_URL",
  },
  {
    name: "billing",
    database: "billing",
    schema: "prisma/billing/schema.prisma",
    envVar: "BILLING_DATABASE_URL",
  },
  {
    name: "notifications-audit",
    database: "notifications_audit",
    schema: "prisma/notifications-audit/schema.prisma",
    envVar: "NOTIFICATIONS_AUDIT_DATABASE_URL",
  },
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const service of serviceSchemas) {
    console.log(`${service.name}\t${service.schema}\t${service.envVar}`);
  }
}
