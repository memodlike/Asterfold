export interface WorkflowRunEvidence {
  name: string;
  head_sha: string;
  event: string;
  status: string;
  conclusion: string | null;
}
export function verifyRequiredWorkflowRuns(runs: WorkflowRunEvidence[], required?: string[], sha?: string): true;
