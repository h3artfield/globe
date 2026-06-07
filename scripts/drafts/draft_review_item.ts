import { generateNarrativeDraftForReviewItem } from "@/lib/dossier/narrativeDraftGenerator";

async function main() {
  const reviewId = process.argv[2];
  if (!reviewId) throw new Error("Usage: npm run draft:review-item -- REVIEW_ID");
  console.log(JSON.stringify(await generateNarrativeDraftForReviewItem(reviewId), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
