import { auditSourceReceipts } from "@/lib/kb/sourceReceipts";
import { BATCH1_TRANSFORM_SOURCES } from "@/lib/kb/batch1Transform/registry";
import { pathExists, repoPath } from "@/lib/pipeline/io";

async function main() {
  console.log("KB Source Receipts Status");
  console.log("=========================");
  console.log("Receipt folder: data/source_receipts/");

  const audit = await auditSourceReceipts();
  const receiptFiles = await Promise.all(
    BATCH1_TRANSFORM_SOURCES.map(async (config) => ({
      sourceId: config.sourceId,
      exists: await pathExists(
        repoPath("data", "source_receipts", config.sourceId + ".source_receipts.v1.json"),
      ),
    })),
  );
  const withReceipts = receiptFiles.filter((entry) => entry.exists).map((entry) => entry.sourceId);

  console.log("");
  console.log("Sources with receipt files: " + (withReceipts.length ? withReceipts.join(", ") : "(none)"));

  console.log("");
  console.log("Raw files without receipts:");
  if (audit.rawWithoutReceipts.length === 0) {
    console.log("  (none)");
  } else {
    for (const item of audit.rawWithoutReceipts) {
      console.log("  " + item.sourceId + ": " + item.rawFilePath);
    }
  }

  console.log("");
  console.log("Canonical files without receipts:");
  if (audit.canonicalWithoutReceipts.length === 0) {
    console.log("  (none)");
  } else {
    for (const item of audit.canonicalWithoutReceipts) {
      console.log("  " + item.sourceId + ": " + item.canonicalFilePath);
    }
  }

  console.log("");
  console.log("Missing URL/license metadata:");
  if (audit.missingMetadata.length === 0) {
    console.log("  (none)");
  } else {
    for (const item of audit.missingMetadata) {
      console.log("  " + item.sourceId + " " + item.receiptId + ": " + item.fields.join(", "));
    }
  }

  console.log("");
  console.log("SHA256 mismatches (file changed since receipt):");
  if (audit.sha256Mismatches.length === 0) {
    console.log("  (none)");
  } else {
    for (const item of audit.sha256Mismatches) {
      console.log("  " + item.sourceId + " [" + item.kind + "]: " + item.filePath);
    }
  }

  const hasProblems =
    audit.rawWithoutReceipts.length > 0 ||
    audit.canonicalWithoutReceipts.length > 0 ||
    audit.sha256Mismatches.length > 0;

  if (hasProblems) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
