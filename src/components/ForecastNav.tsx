import Link from "next/link";

export function ForecastNav() {
  return (
    <nav className="flex flex-wrap gap-3 text-sm">
      <Link className="text-cyan-300 hover:text-cyan-100" href="/">
        Globe
      </Link>
      <Link className="text-cyan-300 hover:text-cyan-100" href="/forecast">
        Forecast Lab
      </Link>
      <Link className="text-cyan-300 hover:text-cyan-100" href="/forecast/agents">
        Agents
      </Link>
      <Link className="text-cyan-300 hover:text-cyan-100" href="/forecast/source-requests">
        Source Requests
      </Link>
      <Link className="text-cyan-300 hover:text-cyan-100" href="/forecast/leaderboard">
        Leaderboard
      </Link>
      <Link className="text-cyan-300 hover:text-cyan-100" href="/about">
        About &amp; Status
      </Link>
      <Link className="text-cyan-300 hover:text-cyan-100" href="/review">
        Review
      </Link>
    </nav>
  );
}
