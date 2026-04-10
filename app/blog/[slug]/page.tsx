import { getPostBySlug, getAllSlugs } from "@/lib/blog";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, ArrowLeft, Flame } from "lucide-react";
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

  // JSON-LD Article structured data
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

      <article className="min-h-screen bg-slate-950">
        {/* Header area */}
        <div className="border-b border-white/5 bg-gradient-to-b from-slate-900/50 to-transparent">
          <div className="container max-w-3xl mx-auto px-4 pt-8 pb-12 md:pt-12 md:pb-16">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>

            <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
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

            <h1 className="text-3xl md:text-4xl lg:text-[2.75rem] font-extrabold text-slate-50 tracking-tight leading-tight">
              {post.title}
            </h1>

            <p className="mt-4 text-lg text-slate-400 leading-relaxed max-w-2xl">
              {post.description}
            </p>
          </div>
        </div>

        {/* Article body */}
        <div className="container max-w-3xl mx-auto px-4 py-10 md:py-14">
          <BlogMarkdown content={post.content} />

          {/* CTA */}
          <div className="mt-16 rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900 to-slate-900/60 p-8 md:p-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Flame className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-slate-100">
              Ready to upgrade your dating photos?
            </h3>
            <p className="mt-2 text-slate-400 max-w-md mx-auto">
              Upload a photo and let AI enhance your lighting, framing &
              color — your face stays 100% real.
            </p>
            <Link
              href="/subscribe/scanner"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
            >
              Try It Free
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}