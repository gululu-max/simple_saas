import fs from "fs";
import path from "path";
import matter from "gray-matter";

// ─── Types ──────────────────────────────────────────────────
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  tags: string[];
  featuredImage?: string;
  content: string;
}

// ─── Paths ──────────────────────────────────────────────────
const BLOG_DIR = path.join(process.cwd(), "content", "blog");

// ─── Helpers ────────────────────────────────────────────────

/** Get all .md files sorted by publishedAt (newest first) */
export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));

  const posts = files
    .map((filename) => {
      const filePath = path.join(BLOG_DIR, filename);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);

      return {
        slug: filename.replace(/\.md$/, ""),
        title: data.title ?? "Untitled",
        description: data.description ?? "",
        publishedAt: data.publishedAt ?? "2026-01-01",
        updatedAt: data.updatedAt,
        author: data.author ?? "Matchfix Team",
        tags: data.tags ?? [],
        featuredImage: data.featuredImage,
        content,
      } satisfies BlogPost;
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

  return posts;
}

/** Get a single post by slug */
export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? "Untitled",
    description: data.description ?? "",
    publishedAt: data.publishedAt ?? "2026-01-01",
    updatedAt: data.updatedAt,
    author: data.author ?? "Matchfix Team",
    tags: data.tags ?? [],
    featuredImage: data.featuredImage,
    content,
  };
}

/** Get all slugs — for generateStaticParams */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}