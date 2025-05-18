# Product Requirements Document (PRD): PregNut Static Blog

## Overview
Add a simple static blog to the PregNut Eleventy site, with a blog listing page and individual post pages, suitable for deployment on Cloudflare Pages.

## Goals
- Allow site visitors to view a list of blog posts at `/blog/`.
- Allow visitors to view individual blog posts at `/blog/{slug}/`.
- Ensure navigation to the blog is present on all main pages.
- Ensure compatibility with Cloudflare Pages static hosting.

## Requirements

### Content Management
- Blog posts are written in Markdown and stored in `src/posts/`.
- Each post has front matter with at least `title`, `date`, and `layout: post.njk`.

### Blog Listing Page
- Located at `/blog/` (generated from `src/blog.html`).
- Lists all posts in reverse chronological order.
- Each post links to its individual page.

### Individual Post Pages
- Each post is rendered using the `post.njk` layout.
- Each post is accessible at `/blog/{slug}/`.

### Navigation
- The main navigation bar includes a link to the blog.
- The blog link is highlighted when on the blog page.

### Deployment
- The Eleventy build outputs to `_site/`.
- The site is deployed to Cloudflare Pages with `_site` as the output directory.

## Nice-to-Haves
- Pagination for the blog listing (if many posts).
- Author and date display on posts.
- SEO meta tags for blog posts.

---

# Implementation Plan
1. Ensure Eleventy is configured to collect posts from `src/posts/`.
2. Verify `src/blog.html` lists posts using the `collections.post` collection.
3. Ensure individual posts use the `post.njk` layout and are output to `/blog/{slug}/`.
4. Test navigation and blog links.
5. Confirm build output and test on Cloudflare Pages.
