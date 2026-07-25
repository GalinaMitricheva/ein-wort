import Anthropic from "@anthropic-ai/sdk";
import { assertNoCredentialConflict, hasCredential } from "../src/config.ts";

// Credential smoke test (plan.md 0.6). Answers one question before anything is
// built on top of it: does the ANTHROPIC_AUTH_TOKEN minted by `claude
// setup-token` authenticate against BOTH endpoints the app needs?
//
//   1. messages.create        — every dossier and anchor call (phase 3)
//   2. messages.batches.create — the nightly capture job (task 3.11)
//
// Batch support on a subscription-derived token is unverified. If (2) fails
// with an auth/permission error, the capture feature needs redesigning — and
// it is far cheaper to learn that here than at task 3.11.

const MODEL = "claude-opus-4-8";

async function main(): Promise<void> {
  assertNoCredentialConflict();
  if (!hasCredential()) {
    console.error(
      "No credential set. Run `claude setup-token`, then put the result in\n" +
        ".env as ANTHROPIC_AUTH_TOKEN (see docs/architecture.md 7b), and re-run.",
    );
    process.exit(1);
  }

  // Bare constructor — the SDK reads ANTHROPIC_AUTH_TOKEN from the environment.
  const client = new Anthropic();

  const messagesOk = await checkMessages(client);
  const batchOk = await checkBatch(client);

  console.log("\n─── result ─────────────────────────");
  console.log(`  messages.create        ${mark(messagesOk)}`);
  console.log(`  messages.batches.create ${mark(batchOk)}`);
  console.log("────────────────────────────────────");

  if (!batchOk) {
    console.log(
      "\nBatch calls do not work on this credential. The nightly capture job\n" +
        "(architecture.md 5b) assumes they do — revisit before task 3.11.",
    );
  }
  process.exit(messagesOk && batchOk ? 0 : 1);
}

async function checkMessages(client: Anthropic): Promise<boolean> {
  process.stdout.write("Testing messages.create … ");
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
    });
    const text = res.content.find((b) => b.type === "text");
    console.log(`ok (model ${res.model}, said "${text?.text.trim() ?? ""}")`);
    return true;
  } catch (err) {
    reportError(err);
    return false;
  }
}

async function checkBatch(client: Anthropic): Promise<boolean> {
  process.stdout.write("Testing messages.batches.create … ");
  let batchId: string;
  try {
    const batch = await client.messages.batches.create({
      requests: [
        {
          custom_id: "smoke-1",
          params: {
            model: MODEL,
            max_tokens: 16,
            messages: [{ role: "user", content: "Reply with the single word: ok" }],
          },
        },
      ],
    });
    batchId = batch.id;
    // Acceptance is the auth signal we care about. Completion can take up to an
    // hour, so we confirm the batch was accepted, poll briefly, and stop.
    console.log(`accepted (batch ${batch.id}, status ${batch.processing_status})`);
  } catch (err) {
    reportError(err);
    return false;
  }

  process.stdout.write("Polling for completion (up to 90s) … ");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const batch = await client.messages.batches.retrieve(batchId);
    if (batch.processing_status === "ended") {
      console.log("ended");
      for await (const result of await client.messages.batches.results(batchId)) {
        console.log(`  ${result.custom_id}: ${result.result.type}`);
      }
      return true;
    }
    await sleep(5_000);
  }
  // Still processing is not a failure — the create call already proved auth works.
  console.log("still processing (auth confirmed by acceptance; that's the point)");
  return true;
}

function reportError(err: unknown): void {
  if (err instanceof Anthropic.AuthenticationError) {
    console.log("FAILED — authentication (401). The token is invalid or expired.");
  } else if (err instanceof Anthropic.PermissionDeniedError) {
    console.log("FAILED — permission (403). This credential can't use this endpoint.");
  } else if (err instanceof Anthropic.APIError) {
    console.log(`FAILED — API error ${err.status ?? "?"}: ${err.message}`);
  } else {
    console.log(`FAILED — ${String(err)}`);
  }
}

const mark = (ok: boolean): string => (ok ? "PASS" : "FAIL");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

await main();
