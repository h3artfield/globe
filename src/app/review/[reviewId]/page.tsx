import { findDraftById, getReviewItem, getCountryChunks } from "@/lib/review/reviewWorkflow";

type ReviewDetailProps = { params: Promise<{ reviewId: string }> };

function sourceQuality(sourceId: string): string {
  if (sourceId.includes("world_bank") || sourceId.startsWith("un_") || sourceId === "vdem" || sourceId === "wipo") return "international_dataset";
  if (sourceId === "wikipedia") return "wikipedia";
  if (sourceId.includes("manual")) return "manual_note";
  return "unknown";
}

function ClaimActionForm({ claimId, action, label }: { claimId: string; action: string; label: string }) {
  return (
    <form action={`/api/review/claim/${claimId}/${action}`} method="post">
      <button className="rounded bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950" type="submit">
        {label}
      </button>
    </form>
  );
}

export default async function ReviewDetail({ params }: ReviewDetailProps) {
  const { reviewId } = await params;
  const item = await getReviewItem(reviewId);

  if (!item?.country_code) {
    return <main className="min-h-screen bg-slate-950 p-6 text-white">Review item not found.</main>;
  }

  const chunks = (await getCountryChunks(item.country_code)).filter((chunk) => chunk.module === item.module).slice(0, 8);
  const drafts = await Promise.all((item.draft_ids ?? []).map((draftId) => findDraftById(draftId)));

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{item.review_id}</h1>
          <p className="text-slate-400">{item.country_code} / {item.module}</p>
        </div>
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold">Review item</h2>
          <p className="mt-2 text-sm text-slate-300">{item.reason}</p>
          <p className="mt-2 text-sm text-slate-400">Suggested sources: {item.suggested_sources.join(", ")}</p>
          <form className="mt-4" action={`/api/review/item/${item.review_id}/draft`} method="post">
            <button className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">
              Generate draft from sources
            </button>
          </form>
        </section>
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold">Retrieved chunks / source snippets</h2>
          <div className="mt-3 space-y-3">
            {chunks.map((chunk) => (
              <div key={chunk.chunk_id} className="rounded bg-slate-950 p-3 text-sm">
                <p className="text-cyan-300">{chunk.chunk_id}</p>
                <p className="mt-1 text-slate-300">{chunk.text.slice(0, 500)}</p>
                <p className="mt-1 text-xs text-slate-500">Sources: {chunk.source_ids.join(", ") || "none"}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {chunk.source_ids.map((sourceId) => (
                    <span key={sourceId} className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                      {sourceQuality(sourceId)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold">Drafted claims</h2>
          <div className="mt-3 space-y-3">
            {drafts.filter(Boolean).flatMap((draft) => draft?.claims ?? []).map((claim) => (
              <div key={claim.claim_id} className="rounded bg-slate-950 p-3 text-sm">
                <p className="text-cyan-300">{claim.claim_id}</p>
                <p className="mt-1">{claim.text}</p>
                <p className="mt-1 text-xs text-slate-500">Type: {claim.claim_type} / Confidence: {claim.confidence} / Status: {claim.review_status}</p>
                <p className="mt-1 text-xs text-slate-500">Sources: {claim.source_ids.join(", ") || "none"} / {claim.notes}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ClaimActionForm claimId={claim.claim_id} action="approve" label="Approve claim" />
                  <ClaimActionForm claimId={claim.claim_id} action="verify" label="Mark verified" />
                  <ClaimActionForm claimId={claim.claim_id} action="needs-better-sources" label="Needs better sources" />
                  <ClaimActionForm claimId={claim.claim_id} action="reject" label="Reject claim" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
