import { runForSchemas } from "./run-for-schemas.mjs";

runForSchemas({
  command: ["migrate", "deploy"],
  label: "migrate:deploy",
  requireDatabaseUrl: true,
});
