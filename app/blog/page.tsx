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
    <div className="min-h-screen bg-canvas">
      {/* Hero — Airbnb 标题区：白底 + hairline 下边线 */}
      <section className="border-b border-hairline-soft">
        <div className="container max-w-4xl mx-auto px-6 py-12 md:py-section">
          <h1 className="text-[28px] md:text-[32px] font-bold text-ink tracking-[-0.5px] leading-[1.18]">
            Blog
          </h1>
          <p className="mt-3 text-base md:text-[17px] text-ink-body leading-[1.5] max-w-2xl">
            Expert tips on dating profile photos, AI enhancement, and getting
            more matches.
          </p>
        </div>
      </section>

      {/* Posts list — Airbnb 卡片：白底 hairline + 单层阴影 hover */}
      <section className="container max-w-4xl mx-auto px-6 py-12">
        {posts.length === 0 ? (
          <p className="text-ink-muted text-center py-20">
            No posts yet — check back soon!
          </p>
        ) : (
          <div className="grid gap-4">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block rounded-card border border-hairline bg-canvas p-6 md:p-8 hover:shadow-ab-card transition-shadow"
              >
                <div className="flex items-center gap-3 text-[13px] text-ink-muted mb-3 leading-[1.23]">
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

                <h2 className="text-[20px] md:text-[22px] font-semibold text-ink leading-[1.25] tracking-[-0.18px]">
                  {post.title}
                </h2>

                <p className="mt-2 text-sm text-ink-body line-clamp-2 leading-[1.5]">
                  {post.description}
                </p>

                {post.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[13px] px-2.5 py-1 rounded-pill bg-surface-soft text-ink-muted leading-[1.23]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-rausch opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
