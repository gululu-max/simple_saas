import Link from "next/link";
import { Flame } from "lucide-react"; // 换成了代表“划玻璃/毒舌开喷”的火焰图标

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 hover:opacity-90 transition-opacity"
    >
      <div className="flex items-center justify-center p-1 bg-primary/10 rounded-md">
        <Flame className="w-5 h-5 text-primary" />
      </div>
      <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
        Matchfix
      </span>
    </Link>
  );
}