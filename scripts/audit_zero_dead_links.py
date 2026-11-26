#!/usr/bin/env python3
"""Zero-dead-link audit: crawl every <a href>/<img src>/link rel in the
prerendered site + docs HTML trees and the web source tree."""
import json, pathlib, re, sys

root = pathlib.Path("/home/z/my-project/rdm-studio")
errors, checked = [], 0

def audit_html_tree(dist: pathlib.Path, base: str):
    global checked
    pages = list(dist.rglob("*.html"))
    routes = {p.relative_to(dist).with_suffix("") for p in pages}
    routes = {("" if str(r) == "index" else f"/{r}") for r in routes}
    routes.add("/")
    for page in pages:
        html = page.read_text(errors="ignore")
        hrefs = re.findall(r'<a[^>]+href="([^"]+)"', html)
        srcs = re.findall(r'<img[^>]+src="([^"]+)"', html)
        links = re.findall(r'<link[^>]+href="([^"]+)"', html)
        for url in hrefs + srcs + links:
            checked += 1
            if url.startswith(("http://", "https://")):
                if "example.com" in url or url.rstrip("/") in (
                    "https://vercel.app",
                ):
                    errors.append(f"{page.name}: placeholder external {url}")
                continue
            if url.startswith("#"):
                continue
            if url.startswith("mailto:") or url.startswith("data:"):
                continue
            path = url.split("#")[0].split("?")[0]
            if path.startswith("/_astro") or path.startswith("/client") or path.startswith("/media") or path.endswith((".png", ".webp", ".svg", ".woff2")) or "apple-touch-icon" in path:
                if not (dist / path.lstrip("/")).exists():
                    errors.append(f"{page.name}: missing asset {url}")
                continue
            if path == "" or (path.endswith("/") and (dist / path / "index.html").exists()):
                continue
            target = (dist / path.lstrip("/"))
            if (target / "index.html").exists() or target.exists() or target.with_suffix(".html").exists():
                continue
            if path in routes or path.rstrip("/") in routes:
                continue
            errors.append(f"{base}{page.relative_to(dist)}: dead route {url}")

def audit_web_src():
    src = root / "apps/web/src"
    for f in src.rglob("*.tsx"):
        t = f.read_text(errors="ignore")
        for m in re.finditer(r'href="(#)"', t):
            errors.append(f"apps/web/src/{f.relative_to(src)}: href=# placeholder")
        for m in re.finditer(r'https?://example\.com', t):
            errors.append(f"apps/web/src/{f.relative_to(src)}: example.com placeholder")

site_dist = root / "apps/site/dist/deploy"
docs_dist = root / "apps/docs/dist"
if site_dist.exists():
    audit_html_tree(site_dist, "site:")
if docs_dist.exists():
    audit_html_tree(docs_dist, "docs:")
audit_web_src()
print(f"checked {checked} URLs across site+docs HTML and web src")
if errors:
    print(f"DEAD LINKS ({len(errors)}):")
    for e in errors[:40]:
        print(" -", e)
    sys.exit(1)
print("ZERO dead links ✓")
