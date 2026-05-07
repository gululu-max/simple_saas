import Link from "next/link";
import { Flame } from "lucide-react";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 hover:opacity-90 transition-opacity"
    >
      <div className="flex items-center justify-center p-1 bg-rausch/10 rounded-md">
        <Flame className="w-5 h-5 text-rausch" />
      </div>
      <span className="font-bold text-xl tracking-tight text-rausch">
        Matchfix
      </span>
    </Link>
  );
}
