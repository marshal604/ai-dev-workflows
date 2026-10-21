// Reproduces a production error locally and prints the GitHub "create issue" request a monitor
// would send for it. Usage:
//   node scripts/simulate-incident.ts [weightKg] | gh api repos/<owner>/<repo>/issues --input -
import { createHash } from "node:crypto";
import { shippingFeeCents } from "../src/shipping.ts";

const weightKg = Number(process.argv[2] ?? 23.5);

function repoRelative(stack: string): string {
  return stack.replaceAll(`file://${process.cwd()}/`, "").replaceAll(`${process.cwd()}/`, "");
}

try {
  const fee = shippingFeeCents(weightKg);
  console.error(`No error: shippingFeeCents(${weightKg}) = ${fee}`);
  process.exit(1);
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  const stack = repoRelative(err.stack ?? "");
  // Group by error type and the first app frame without line numbers, so edits don't split issues
  const topFrame = stack.split("\n").find((line) => line.includes("src/")) ?? "";
  const fingerprint = createHash("sha256")
    .update(`${err.name}|${topFrame.replace(/:\d+:\d+\)?\s*$/, "").trim()}`)
    .digest("hex")
    .slice(0, 12);

  const body = [
    "**Source:** `simulator`",
    "",
    `Checkout failed while quoting shipping for a ${weightKg} kg parcel.`,
    "",
    "```",
    stack,
    "```",
    "",
    `<!-- incident-fingerprint: ${fingerprint} -->`,
  ].join("\n");

  process.stdout.write(
    JSON.stringify({ title: `${err.name}: ${err.message}`, body, labels: ["incident"] }),
  );
}
