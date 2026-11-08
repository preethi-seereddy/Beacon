import Link from "next/link";
import { Beau } from "@/components/Beau";

export default function NotFound() {
  return (
    <main className="screen flex flex-col items-center justify-center gap-4 text-center">
      <Beau size={96} />
      <h1>Beau couldn’t find that page</h1>
      <Link className="btn btn-grad" href="/">
        Back home
      </Link>
    </main>
  );
}
