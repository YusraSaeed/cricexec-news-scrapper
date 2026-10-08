# Cricket News Scraper

A small Next.js / Vercel tool that extracts recent articles directly from the
HTML of cricket board, league, tournament and franchise news/media listing pages.

It does not use OpenAI or Apify.

## What it does

1. Enter one or more news/media listing URLs.
2. Or upload a CSV containing URLs.
3. Choose "Articles since".
4. The app downloads each listing page's HTML.
5. It finds dated article cards shown on that page.
6. It keeps articles dated on or after the selected date.
7. It returns:
   - Source
   - Article Date
   - Article Headline
   - Article URL
   - Feature Image URL
8. Download all results as CSV.

## Important design choice

This v1 does NOT:
- open each article page,
- paginate through older pages,
- use a browser,
- use AI,
- use Apify.

The publication date is taken from the main listing page, as requested.

Because the intended window is usually only 1-3 days, the tool only processes
the articles already present on the supplied listing page.

## Generic extraction

The scraper is deliberately generic. It tries to identify article cards from:

- links,
- nearby headings,
- `<time>` elements,
- date/time/published/meta classes,
- standard date text,
- relative dates such as `7h`, `3d`, `yesterday`,
- nearby `<img>` / lazy-loaded image attributes.

If a website renders the article list entirely with JavaScript and the articles
are not present in the returned HTML, the tool does not silently pretend there
are zero articles. It reports:

"No dated article cards were detected..."

That source can then receive a small site-specific adapter later.

## Local setup

Requirements:
- Node.js 20.9+ recommended

Run:

```bash
npm install
npm run dev
```

On Windows PowerShell, if npm scripts are blocked:

```powershell
npm.cmd install
npm.cmd run dev
```

Open:

`http://localhost:3000`

## GitHub + Vercel

Push the project to GitHub and import the repository into Vercel.

No environment variables are required for this version.

## Example input

```text
https://www.icc-cricket.com/media-releases
```

Choose a recent date and click **Scrape Articles**.

## Notes

- Use the actual news/media/archive listing page, not the website homepage.
- Public HTML pages work best.
- Some websites may block automated fetches.
- Some JavaScript-heavy websites may need a custom adapter later.
- Feature Image URL can be blank when the listing card does not expose an image.
