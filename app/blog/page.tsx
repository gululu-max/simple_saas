import { getAllPosts } from "@/lib/blog";
import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, ArrowRight, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Dating Photo Tips & Guides",
  description:
    "Expert tips on dating profile photos, AI photo enhancement, and getting more matches on Tinder, Bumble & Hinge.",
  alternates: {
    canonical: "https://www.matchfix.site/blog",
  },
};

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 230));
}

export default function BlogListPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <section className="border-b border-white/5 bg-gradient-to-b from-slate-900/50 to-transparent">
        <div className="container max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-50 tracking-tight">
            Blog
          </h1>
          <p className="mt-3 text-lg text-slate-400 max-w-2xl">
            Expert tips on dating profile photos, AI enhancement, and getting
            more matches.
          </p>
        </div>
      </section>

      {/* Posts grid */}
      <section className="container max-w-4xl mx-auto px-4 py-12">
        {posts.length === 0 ? (
          <p className="text-slate-500 text-center py-20">
            No posts yet — check back soon!
          </p>
        ) : (
          <div className="grid gap-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block rounded-xl border border-slate-800/60 bg-slate-900/40 p-6 md:p-8 hover:border-slate-700 hover:bg-slate-900/70 transition-all duration-200"
              >
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(post.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {estimateReadTime(post.content)} min read
                  </span>
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-slate-100 group-hover:text-red-400 transition-colors leading-snug">
                  {post.title}
                </h2>

                <p className="mt-2 text-sm text-slate-400 line-clamp-2 leading-relaxed">
                  {post.description}
                </p>

                {post.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2.5 py-1 rounded-full bg-slate-800/70 text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Read more <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}