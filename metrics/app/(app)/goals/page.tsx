import { GoalsAndBenchmarks } from "@/components/GoalsAndBenchmarks";

// All data fetching and mutations happen client-side inside the
// component — RLS scopes everything to the caller automatically.
export default function GoalsPage() {
  return <GoalsAndBenchmarks />;
}
