import { readFile } from "node:fs/promises";

export function verifyRequiredWorkflowRuns(runs, required = ["CI", "CodeQL"], sha = process.env.GITHUB_SHA) {
  const failures = [];
  for (const workflowName of required) {
    const candidates = runs.filter((run) => run.name === workflowName && run.head_sha === sha && run.event === "push");
    if (!candidates.length) { failures.push(`${workflowName}: no push run for ${sha}`); continue; }
    const successful = candidates.some((run) => run.status === "completed" && run.conclusion === "success");
    if (!successful) failures.push(`${workflowName}: exact-SHA push run is not successful`);
  }
  if (failures.length) throw new Error(`Required workflow verification failed:\n- ${failures.join("\n- ")}`);
  return true;
}

if (process.argv[1]?.endsWith("verify-required-workflows.mjs")) {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: node scripts/verify-required-workflows.mjs <workflow-runs.json>");
  const payload = JSON.parse(await readFile(path, "utf8"));
  verifyRequiredWorkflowRuns(payload.workflow_runs ?? payload, (process.env.REQUIRED_WORKFLOWS ?? "CI,CodeQL").split(","), process.env.EXPECTED_SOURCE_SHA ?? process.env.GITHUB_SHA);
  console.log("Required exact-SHA workflow runs are successful");
}
