import { spawnSync } from "node:child_process";

const attempts = 3;
const retryDelaysMs = [3_000, 10_000];
const transientFailure = /(?:EAI_AGAIN|ECONNRESET|ECONNREFUSED|ENETUNREACH|ENOTFOUND|ETIMEDOUT|E50[234]|429|502|503|504|maintenance|service unavailable|socket hang up)/i;

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function parseAuditReport(output) {
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const result = spawnSync(
    "npm",
    ["audit", "--omit=dev", "--audit-level=high", "--json"],
    { encoding: "utf8" },
  );

  const stdout = result.stdout?.trim() ?? "";
  const stderr = result.stderr?.trim() ?? "";
  const report = parseAuditReport(stdout);

  if (result.status === 0) {
    if (stdout) console.log(stdout);
    process.exit(0);
  }

  if (report?.metadata?.vulnerabilities) {
    if (stdout) console.error(stdout);
    process.exit(result.status ?? 1);
  }

  const diagnostic = `${stderr}\n${stdout}`.trim();
  const canRetry = transientFailure.test(diagnostic) && attempt < attempts;

  if (!canRetry) {
    console.error(diagnostic || "npm audit failed without diagnostic output.");
    process.exit(result.status ?? 1);
  }

  const delayMs = retryDelaysMs[attempt - 1];
  console.warn(`npm audit service unavailable (attempt ${attempt}/${attempts}); retrying in ${delayMs / 1_000}s.`);
  sleep(delayMs);
}
