import Link from "next/link";
import { listReviewItems } from "@/lib/review/reviewWorkflow";

export default async function ReviewDashboard() {
  const items = await listReviewItems();

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link className="text-cyan-300 hover:text-cyan-100" href="/">
            Globe
          </Link>
          <Link className="text-cyan-300 hover:text-cyan-100" href="/about">
            About &amp; Status
          </Link>
        </nav>
        <h1 className="text-3xl font-bold">Review Dashboard</h1>
        <p className="mt-2 text-slate-400">Pending narrative modules, source requests, and draft status.</p>
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-900 text-left text-slate-300">
              <tr>
                <th className="p-3">Country</th>
                <th className="p-3">Module</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Drafts</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.review_id} className="border-t border-slate-800">
                  <td className="p-3">{item.country_code}</td>
                  <td className="p-3">{item.module}</td>
                  <td className="p-3 text-slate-400">{item.reason}</td>
                  <td className="p-3">{item.draft_ids?.length ?? 0}</td>
                  <td className="p-3">unknown</td>
                  <td className="p-3">
                    <Link className="text-cyan-300 hover:text-cyan-100" href={`/review/${item.review_id}`}>
                      Open item
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
