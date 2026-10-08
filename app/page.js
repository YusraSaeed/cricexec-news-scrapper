"use client";

import { useState } from "react";

const MAX_SOURCES = 20;

function cleanUrl(value) {
  const trimmed = value.trim().replace(/[)\]}>.,;]+$/, "");
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function parseSources(text) {
  const values = text
    .split(/[\n\t,;]+/)
    .map(cleanUrl)
    .filter(Boolean);

  return [...new Set(values)];
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function sourceLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function Home() {
  const [sources, setSources] = useState("");
  const [sinceDate, setSinceDate] = useState("");
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalCandidates, setTotalCandidates] = useState(0);

  async function handleCsvUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();

    const found =
      text.match(/https?:\/\/[^\s,"']+/gi) || [];

    const existing = parseSources(sources);
    const uploaded = found.map(cleanUrl).filter(Boolean);

    setSources(
      [...new Set([...existing, ...uploaded])]
        .slice(0, MAX_SOURCES)
        .join("\n")
    );

    event.target.value = "";
  }

  function updateProgress(url, changes) {
    setProgress((current) =>
      current.map((item) =>
        item.url === url ? { ...item, ...changes } : item
      )
    );
  }

  async function scrape(event) {
    event.preventDefault();

    setError("");
    setResults([]);
    setTotalCandidates(0);

    const parsedSources = parseSources(sources);

    if (!parsedSources.length) {
      setError("Add at least one source URL.");
      return;
    }

    if (parsedSources.length > MAX_SOURCES) {
      setError(`Maximum ${MAX_SOURCES} source URLs per run.`);
      return;
    }

    if (!sinceDate) {
      setError("Select a start date.");
      return;
    }

    setProgress(
      parsedSources.map((url) => ({
        url,
        status: "pending",
        sourceName: sourceLabel(url),
        count: 0,
        message: "",
      }))
    );

    setLoading(true);

    let combinedResults = [];
    let combinedCandidates = 0;
    let failed = 0;

    try {
      for (const url of parsedSources) {
        updateProgress(url, {
          status: "processing",
          message: "Reading listing page...",
        });

        try {
          const response = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              sinceDate,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Scraping failed.");
          }

          combinedCandidates += data.scannedCandidates || 0;
          combinedResults = [
            ...combinedResults,
            ...(data.results || []),
          ];

          // De-duplicate across sources by article URL.
          const byUrl = new Map();
          for (const item of combinedResults) {
            byUrl.set(item.articleUrl, item);
          }
          combinedResults = [...byUrl.values()];

          combinedResults.sort((a, b) => {
            const dateCompare = (b.articleDate || "").localeCompare(
              a.articleDate || ""
            );
            if (dateCompare !== 0) return dateCompare;
            return (a.headline || "").localeCompare(b.headline || "");
          });

          setResults([...combinedResults]);
          setTotalCandidates(combinedCandidates);

          updateProgress(url, {
            status: "done",
            sourceName: data.sourceName || sourceLabel(url),
            count: data.results?.length || 0,
            message:
              data.warning ||
              `${data.results?.length || 0} article(s) found`,
          });
        } catch (err) {
          failed += 1;

          updateProgress(url, {
            status: "failed",
            message: err?.message || "Failed",
          });
        }
      }

      if (failed > 0) {
        setError(
          `${failed} source${failed === 1 ? "" : "s"} could not be processed.`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!results.length) return;

    const headers = [
      "Source",
      "Article Date",
      "Article Headline",
      "Article URL",
      "Feature Image URL",
    ];

    const rows = results.map((row) => [
      row.source,
      row.articleDate,
      row.headline,
      row.articleUrl,
      row.featureImageUrl,
    ]);

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = objectUrl;
    a.download = `cricket-news-${sinceDate}.csv`;
    a.click();

    URL.revokeObjectURL(objectUrl);
  }

  return (
    <main className="container">
      <h1>Cricket News Scraper</h1>

      <p className="intro">
        Extract recent articles from cricket board, league, tournament and
        franchise news or media pages.
      </p>

      <form className="card" onSubmit={scrape}>
        <label>
          News / media page URLs
          <span className="hint">
            One per line, maximum {MAX_SOURCES}
          </span>
        </label>

        <textarea
          rows={9}
          value={sources}
          onChange={(e) => setSources(e.target.value)}
          placeholder={
            "https://www.icc-cricket.com/media-releases\nhttps://example.com/news"
          }
          disabled={loading}
        />

        <div className="formRow">
          <label className="fileLabel">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              disabled={loading}
            />
          </label>

          <label>
            Articles since
            <input
              type="date"
              value={sinceDate}
              onChange={(e) => setSinceDate(e.target.value)}
              disabled={loading}
            />
          </label>
        </div>

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Scraping..." : "Scrape Articles"}
        </button>

        {error && <p className="error">{error}</p>}
      </form>

      {progress.length > 0 && (
        <section className="statusCard">
          <h2>Processing Status</h2>

          {progress.map((item) => (
            <div className="statusRow" key={item.url}>
              <div className={`statusIcon ${item.status}`}>
                {item.status === "pending" && "○"}
                {item.status === "processing" && "…"}
                {item.status === "done" && "✓"}
                {item.status === "failed" && "✕"}
              </div>

              <div className="statusSource">
                <strong>{item.sourceName}</strong>
                <span>{item.url}</span>
              </div>

              <div className="statusRight">
                <strong>
                  {item.status === "pending" && "Waiting"}
                  {item.status === "processing" && "Processing"}
                  {item.status === "done" && "Done"}
                  {item.status === "failed" && "Failed"}
                </strong>

                <span className={item.status === "failed" ? "statusError" : ""}>
                  {item.message}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {!loading && progress.length > 0 && (
        <div className="summary">
          Found <strong>{results.length}</strong> article
          {results.length === 1 ? "" : "s"} since the selected date.
          {totalCandidates > 0 && (
            <>
              {" "}
              Checked <strong>{totalCandidates}</strong> dated article candidate
              {totalCandidates === 1 ? "" : "s"}.
            </>
          )}
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="resultsHeader">
            <h2>Articles</h2>
            <button className="secondary" onClick={downloadCsv}>
              Download CSV
            </button>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Date</th>
                  <th>Headline</th>
                  <th>Feature Image</th>
                  <th>Article</th>
                </tr>
              </thead>

              <tbody>
                {results.map((row) => (
                  <tr key={row.articleUrl}>
                    <td>{row.source}</td>
                    <td>{row.articleDate}</td>
                    <td className="headline">{row.headline}</td>
                    <td>
                      {row.featureImageUrl ? (
                        <a
                          href={row.featureImageUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open image
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <a
                        href={row.articleUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
