import { redirect } from "next/navigation";

// Root just points at Goals & Metrics — the middleware handles the
// signed-out case (bounce to /login) so we never render anything here.
export default function Home() {
  redirect("/goals");
}
