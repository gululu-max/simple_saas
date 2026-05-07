import { getPostBySlug, getAllSlugs } from "@/lib/blog";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, ArrowLeft, ArrowRight, Flame } from "lucide-react";
import { BlogMarkdown } from "@/components/blog/blog-markdown";

// ─── Static params for build-time generation ────────────────
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

// ─── Dynamic SEO metadata ───────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const url = `https://www.matchfix.site/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
      images: post.featuredImage ? [post.featuredImage] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 230));
}

// ─── Page ───────────────────────────────────────────────────
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const readTime = estimateReadTime(post.content);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: {
      "@type": "Organization",
      name: post.author,
      url: "https://www.matchfix.site",
    },
    publisher: {
      "@type": "Organization",
      name: "Matchfix",
      url: "https://www.matchfix.site",
      logo: {
        "@type": "ImageObject",
        url: "https://www.matchfix.site/logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.matchfix.site/blog/${post.slug}`,
    },
    ...(post.featuredImage && { image: post.featuredImage }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="min-h-screen bg-canvas">
        {/* Header — Airbnb listing-detail 风格：白底 + hairline 分隔 */}
        <div className="border-b border-hairline-soft">
          <div className="container max-w-3xl mx-auto px-6 pt-8 pb-12 md:pt-12 md:pb-16">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink hover:underline transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>

            <div className="flex items-center gap-3 text-[13px] text-ink-muted mb-4 leading-[1.23]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {readTime} min read
              </span>
            </div>

            {/* h1 — Airbnb listing-detail h1: 22-28px / 500，克制收敛 */}
            <h1 className="text-[28px] md:text-[32px] lg:text-[36px] font-semibold text-ink tracking-[-0.5px] leading-[1.18]">
              {post.title}
            </h1>

            <p className="mt-4 text-base md:text-lg text-ink-body leading-[1.5] max-w-2xl">
              {post.description}
            </p>
          </div>
        </div>

        {/* Article body */}
        <div className="container max-w-3xl mx-auto px-6 py-10 md:py-14">
          <BlogMarkdown content={post.content} />

          {/* CTA — Airbnb 卡片：白底 + hairline + 单层阴影 + Rausch CTA */}
          <div className="mt-16 rounded-card border border-hairline bg-canvas shadow-ab-card p-8 md:p-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-pill bg-rausch/10 flex items-center justify-center">
                <Flame className="w-6 h-6 text-rausch" />
              </div>
            </div>
            <h3 className="text-[20px] md:text-[22px] font-semibold text-ink leading-[1.25] tracking-[-0.18px]">
              Ready to upgrade your dating photos?
            </h3>
            <p className="mt-2 text-ink-body text-base leading-[1.5] max-w-md mx-auto">
              Upload a photo and let AI enhance your lighting, framing &
              color — your face stays 100% real.
            </p>
            <Link
              href="/subscribe/scanner"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-btn bg-rausch px-6 h-12 text-base font-medium text-white transition-colors hover:bg-rausch-active"
            >
              Try It Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
