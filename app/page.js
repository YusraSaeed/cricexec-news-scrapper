"use client";

import { useMemo, useState } from "react";


const MAX_SOURCES = 20;


/* =========================================================
   HELPERS
========================================================= */

function cleanUrl(value) {
  const trimmed =
    value
      .trim()
      .replace(/[)\]}>.,;]+$/, "");

  if (!trimmed) {
    return null;
  }

  try {
    const url =
      new URL(trimmed);

    if (
      !["http:", "https:"].includes(
        url.protocol
      )
    ) {
      return null;
    }

    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}


function parseSources(text) {
  const values =
    text
      .split(/[\n\t,;]+/)
      .map(cleanUrl)
      .filter(Boolean);

  return [
    ...new Set(values),
  ];
}


function csvEscape(value) {
  const text =
    value == null
      ? ""
      : String(value);

  return `"${text.replaceAll(
    '"',
    '""'
  )}"`;
}


function sourceLabel(url) {
  try {
    return new URL(url)
      .hostname
      .replace(/^www\./, "");
  } catch {
    return url;
  }
}


/* =========================================================
   PAGE
========================================================= */

export default function Home() {
  const [
    sources,
    setSources,
  ] = useState("");

  const [
    sinceDate,
    setSinceDate,
  ] = useState("");

  const [
    results,
    setResults,
  ] = useState([]);

  const [
    progress,
    setProgress,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    totalCandidates,
    setTotalCandidates,
  ] = useState(0);


  /* =======================================================
     NOCODB STATE
  ======================================================= */

  const [
    nocodbChecked,
    setNocodbChecked,
  ] = useState(false);

  const [
    nocodbUploading,
    setNocodbUploading,
  ] = useState(false);

  const [
    nocodbUploaded,
    setNocodbUploaded,
  ] = useState(false);

  const [
    nocodbMessage,
    setNocodbMessage,
  ] = useState("");

  const [
    nocodbError,
    setNocodbError,
  ] = useState("");


  const sourceCount =
    useMemo(
      () =>
        parseSources(
          sources
        ).length,
      [sources]
    );


  const completedCount =
    progress.filter(
      (item) =>
        item.status === "done"
    ).length;


  const failedCount =
    progress.filter(
      (item) =>
        item.status === "failed"
    ).length;


  /* =======================================================
     CSV SOURCE UPLOAD
  ======================================================= */

  async function handleCsvUpload(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }


    const text =
      await file.text();


    const found =
      text.match(
        /https?:\/\/[^\s,"']+/gi
      ) || [];


    const existing =
      parseSources(
        sources
      );


    const uploaded =
      found
        .map(cleanUrl)
        .filter(Boolean);


    setSources(
      [
        ...new Set([
          ...existing,
          ...uploaded,
        ]),
      ]
        .slice(
          0,
          MAX_SOURCES
        )
        .join("\n")
    );


    event.target.value =
      "";
  }


  /* =======================================================
     PROGRESS
  ======================================================= */

  function updateProgress(
    url,
    changes
  ) {
    setProgress(
      (current) =>
        current.map(
          (item) =>
            item.url === url
              ? {
                  ...item,
                  ...changes,
                }
              : item
        )
    );
  }


  /* =======================================================
     RESET NOCODB WHEN NEW SCRAPE STARTS
  ======================================================= */

  function resetNocodbState() {
    setNocodbChecked(
      false
    );

    setNocodbUploading(
      false
    );

    setNocodbUploaded(
      false
    );

    setNocodbMessage(
      ""
    );

    setNocodbError(
      ""
    );
  }


  /* =======================================================
     SCRAPE
  ======================================================= */

  async function scrape(
    event
  ) {
    event.preventDefault();


    setError(
      ""
    );

    setResults(
      []
    );

    setTotalCandidates(
      0
    );

    resetNocodbState();


    const parsedSources =
      parseSources(
        sources
      );


    if (
      !parsedSources.length
    ) {
      setError(
        "Add at least one source URL."
      );

      return;
    }


    if (
      parsedSources.length >
      MAX_SOURCES
    ) {
      setError(
        `Maximum ${MAX_SOURCES} source URLs per run.`
      );

      return;
    }


    if (!sinceDate) {
      setError(
        "Select a start date."
      );

      return;
    }


    setProgress(
      parsedSources.map(
        (url) => ({
          url,

          status:
            "pending",

          sourceName:
            sourceLabel(
              url
            ),

          count:
            0,

          message:
            "",
        })
      )
    );


    setLoading(
      true
    );


    let combinedResults =
      [];

    let combinedCandidates =
      0;

    let failed =
      0;


    try {
      for (
        const url of
        parsedSources
      ) {
        updateProgress(
          url,
          {
            status:
              "processing",

            message:
              "Reading source...",
          }
        );


        try {
          const response =
            await fetch(
              "/api/scrape",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    url,
                    sinceDate,
                  }),
              }
            );


          const data =
            await response.json();


          if (
            !response.ok
          ) {
            throw new Error(
              data.error ||
                "Scraping failed."
            );
          }


          combinedCandidates +=
            data.scannedCandidates ||
            0;


          combinedResults = [
            ...combinedResults,
            ...(data.results || []),
          ];


          /*
           * De-duplicate across
           * all scraped sources.
           */
          const byUrl =
            new Map();


          for (
            const item of
            combinedResults
          ) {
            if (
              item.articleUrl
            ) {
              byUrl.set(
                item.articleUrl,
                item
              );
            }
          }


          combinedResults = [
            ...byUrl.values(),
          ];


          /*
           * Newest first.
           */
          combinedResults.sort(
            (a, b) => {
              const dateCompare =
                (
                  b.articleDate ||
                  ""
                ).localeCompare(
                  a.articleDate ||
                    ""
                );


              if (
                dateCompare !==
                0
              ) {
                return dateCompare;
              }


              return (
                a.headline ||
                ""
              ).localeCompare(
                b.headline ||
                  ""
              );
            }
          );


          setResults([
            ...combinedResults,
          ]);


          setTotalCandidates(
            combinedCandidates
          );


          updateProgress(
            url,
            {
              status:
                "done",

              sourceName:
                data.sourceName ||
                sourceLabel(
                  url
                ),

              count:
                data.results
                  ?.length ||
                0,

              message:
                data.warning ||
                `${
                  data.results
                    ?.length ||
                  0
                } article(s) found`,
            }
          );
        } catch (err) {
          failed +=
            1;


          updateProgress(
            url,
            {
              status:
                "failed",

              message:
                err?.message ||
                "Failed",
            }
          );
        }
      }


      if (
        failed > 0
      ) {
        setError(
          `${failed} source${
            failed === 1
              ? ""
              : "s"
          } could not be processed.`
        );
      }
    } finally {
      setLoading(
        false
      );
    }
  }


  /* =======================================================
     DOWNLOAD CSV
  ======================================================= */

  function downloadCsv() {
    if (
      !results.length
    ) {
      return;
    }


    const headers = [
      "Source",
      "Article Date",
      "Article Headline",
      "Article URL",
      "Feature Image URL",
    ];


    const rows =
      results.map(
        (row) => [
          row.source,
          row.articleDate,
          row.headline,
          row.articleUrl,
          row.featureImageUrl,
        ]
      );


    const csv = [
      headers
        .map(
          csvEscape
        )
        .join(","),

      ...rows.map(
        (row) =>
          row
            .map(
              csvEscape
            )
            .join(",")
      ),
    ].join("\n");


    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8",
        }
      );


    const objectUrl =
      URL.createObjectURL(
        blob
      );


    const a =
      document.createElement(
        "a"
      );


    a.href =
      objectUrl;

    a.download =
      `cricket-news-${sinceDate}.csv`;


    a.click();


    URL.revokeObjectURL(
      objectUrl
    );
  }


  /* =======================================================
     SEND SCRAPED ARTICLES TO NOCODB
  ======================================================= */

  async function handleNocodbCheckbox(
    checked
  ) {
    /*
     * Should normally not happen
     * because it becomes disabled
     * after successful upload.
     */
    if (!checked) {
      setNocodbChecked(
        false
      );

      return;
    }


    /*
     * Checkbox cannot upload
     * anything until scraping has
     * produced results.
     */
    if (
      !Array.isArray(
        results
      ) ||
      results.length ===
        0
    ) {
      return;
    }


    setNocodbChecked(
      true
    );

    setNocodbUploading(
      true
    );

    setNocodbError(
      ""
    );

    setNocodbMessage(
      "Adding articles to NocoDB..."
    );


    try {
      const response =
        await fetch(
          "/api/nocodb-publish",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                articles:
                  results,
              }),
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data?.ok
      ) {
        throw new Error(
          data?.error ||
            "Could not add articles to NocoDB."
        );
      }


      setNocodbUploaded(
        true
      );


      let message =
        `${data.inserted || 0} article(s) added to NocoDB.`;


      if (
        data.skippedExisting >
        0
      ) {
        message +=
          ` ${data.skippedExisting} existing article(s) skipped.`;
      }


      if (
        data.duplicateInsideScrape >
        0
      ) {
        message +=
          ` ${data.duplicateInsideScrape} duplicate result(s) removed.`;
      }


      if (
        data.invalid >
        0
      ) {
        message +=
          ` ${data.invalid} invalid item(s) skipped.`;
      }


      setNocodbMessage(
        message
      );
    } catch (err) {
      /*
       * Failed uploads should not
       * leave the checkbox checked.
       */
      setNocodbChecked(
        false
      );

      setNocodbUploaded(
        false
      );

      setNocodbMessage(
        ""
      );

      setNocodbError(
        err?.message ||
          "Could not add articles to NocoDB."
      );
    } finally {
      setNocodbUploading(
        false
      );
    }
  }


  /* =======================================================
     UI
  ======================================================= */

  return (
    <>
      <main className="scraper-page">

        {/* ===============================================
            HEADER
        =============================================== */}

        <section className="scraper-hero">
          <div className="scraper-shell">

            <div className="hero-content">
              <div>
                <div className="eyebrow">
                  CRICEXEC RESEARCH TOOL
                </div>

                <h1>
                  Cricket News
                  <span>
                    {" "}
                    Scraper
                  </span>
                </h1>

                <p>
                  Collect recent cricket news from official
                  boards, leagues, tournaments and franchise
                  websites.
                </p>
              </div>

              <div className="hero-stats">
                <div className="hero-stat">
                  <strong>
                    {sourceCount}
                  </strong>

                  <span>
                    Sources
                  </span>
                </div>

                <div className="hero-stat">
                  <strong>
                    {results.length}
                  </strong>

                  <span>
                    Articles
                  </span>
                </div>

                <div className="hero-stat">
                  <strong>
                    {completedCount}
                  </strong>

                  <span>
                    Completed
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>


        <div className="scraper-shell content-shell">

          {/* =============================================
              SCRAPER FORM
          ============================================= */}

          <section className="panel source-panel">

            <div className="panel-heading">
              <div>
                <span className="section-number">
                  01
                </span>

                <div>
                  <h2>
                    Choose sources
                  </h2>

                  <p>
                    Add news or media page URLs manually or
                    import them from a CSV file.
                  </p>
                </div>
              </div>

              <div className="source-count">
                {sourceCount} / {MAX_SOURCES}
              </div>
            </div>


            <form
              onSubmit={
                scrape
              }
            >
              <div className="textarea-wrap">

                <textarea
                  rows={8}
                  value={
                    sources
                  }
                  onChange={(
                    event
                  ) =>
                    setSources(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder={
                    "https://www.icc-cricket.com/news\nhttps://www.nzc.nz/news\nhttps://www.cricket.com.au/news"
                  }
                  disabled={
                    loading
                  }
                />

                <span className="textarea-caption">
                  One URL per line
                </span>

              </div>


              <div className="controls-grid">

                <div className="control-card">
                  <div className="control-icon">
                    CSV
                  </div>

                  <div className="control-body">
                    <strong>
                      Import source list
                    </strong>

                    <span>
                      Upload a CSV containing website URLs
                    </span>

                    <input
                      className="file-input"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={
                        handleCsvUpload
                      }
                      disabled={
                        loading
                      }
                    />
                  </div>
                </div>


                <div className="control-card">
                  <div className="control-icon">
                    DATE
                  </div>

                  <div className="control-body">
                    <strong>
                      Articles since
                    </strong>

                    <span>
                      Start date is inclusive
                    </span>

                    <input
                      className="date-input"
                      type="date"
                      value={
                        sinceDate
                      }
                      onChange={(
                        event
                      ) =>
                        setSinceDate(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={
                        loading
                      }
                    />
                  </div>
                </div>

              </div>


              <div className="form-footer">

                <button
                  className="scrape-button"
                  type="submit"
                  disabled={
                    loading
                  }
                >
                  {loading ? (
                    <>
                      <span className="button-spinner" />
                      Scraping websites...
                    </>
                  ) : (
                    <>
                      <span>
                        ▶
                      </span>
                      Scrape Articles
                    </>
                  )}
                </button>


                <div className="form-help">
                  Maximum {MAX_SOURCES} sources per run
                </div>

              </div>


              {error && (
                <div
                  className="alert alert-error"
                  role="alert"
                >
                  <span className="alert-symbol">
                    !
                  </span>

                  <span>
                    {error}
                  </span>
                </div>
              )}

            </form>
          </section>


          {/* =============================================
              PROCESSING STATUS
          ============================================= */}

          {progress.length >
            0 && (
            <section className="panel progress-panel">

              <div className="panel-heading compact">

                <div>
                  <span className="section-number">
                    02
                  </span>

                  <div>
                    <h2>
                      Processing
                    </h2>

                    <p>
                      Live status for every source in this run.
                    </p>
                  </div>
                </div>


                <div className="progress-summary">
                  <span className="progress-ok">
                    {completedCount} complete
                  </span>

                  {failedCount >
                    0 && (
                    <span className="progress-failed">
                      {failedCount} failed
                    </span>
                  )}
                </div>

              </div>


              <div className="status-list">

                {progress.map(
                  (item) => (
                    <div
                      className={`status-item ${item.status}`}
                      key={
                        item.url
                      }
                    >

                      <div className="status-marker">
                        {item.status ===
                          "pending" &&
                          "○"}

                        {item.status ===
                          "processing" && (
                          <span className="mini-spinner" />
                        )}

                        {item.status ===
                          "done" &&
                          "✓"}

                        {item.status ===
                          "failed" &&
                          "×"}
                      </div>


                      <div className="status-main">

                        <div className="status-name">
                          {
                            item.sourceName
                          }
                        </div>

                        <div className="status-url">
                          {
                            item.url
                          }
                        </div>

                      </div>


                      <div className="status-detail">

                        <strong>
                          {item.status ===
                            "pending" &&
                            "Waiting"}

                          {item.status ===
                            "processing" &&
                            "Processing"}

                          {item.status ===
                            "done" &&
                            "Done"}

                          {item.status ===
                            "failed" &&
                            "Failed"}
                        </strong>

                        <span>
                          {
                            item.message
                          }
                        </span>

                      </div>

                    </div>
                  )
                )}

              </div>

            </section>
          )}


          {/* =============================================
              SUMMARY
          ============================================= */}

          {!loading &&
            progress.length >
              0 && (
              <section className="run-summary">

                <div className="summary-block">
                  <span>
                    Articles found
                  </span>

                  <strong>
                    {results.length}
                  </strong>
                </div>


                <div className="summary-divider" />


                <div className="summary-block">
                  <span>
                    Candidates checked
                  </span>

                  <strong>
                    {totalCandidates}
                  </strong>
                </div>


                <div className="summary-divider" />


                <div className="summary-block">
                  <span>
                    Sources completed
                  </span>

                  <strong>
                    {completedCount}
                  </strong>
                </div>

              </section>
            )}


          {/* =============================================
              RESULTS
          ============================================= */}

          {results.length >
            0 && (
            <section className="panel results-panel">

              <div className="results-top">

                <div>
                  <span className="section-number">
                    03
                  </span>

                  <div>
                    <h2>
                      Scraped Articles
                    </h2>

                    <p>
                      {results.length} article
                      {results.length ===
                      1
                        ? ""
                        : "s"}{" "}
                      ready for review.
                    </p>
                  </div>
                </div>


                <div className="results-actions">

                  <button
                    type="button"
                    className="download-button"
                    onClick={
                      downloadCsv
                    }
                  >
                    <span>
                      ↓
                    </span>

                    Download CSV
                  </button>


                  {/* ===================================
                      NOCODB CHECKBOX
                  =================================== */}

                  <label
                    className={`nocodb-control ${
                      nocodbUploaded
                        ? "uploaded"
                        : ""
                    } ${
                      nocodbUploading
                        ? "uploading"
                        : ""
                    }`}
                  >

                    <input
                      type="checkbox"
                      checked={
                        nocodbChecked
                      }
                      disabled={
                        results.length ===
                          0 ||
                        nocodbUploading ||
                        nocodbUploaded
                      }
                      onChange={(
                        event
                      ) =>
                        handleNocodbCheckbox(
                          event
                            .target
                            .checked
                        )
                      }
                    />


                    <span className="custom-check">
                      {nocodbUploaded
                        ? "✓"
                        : ""}
                    </span>


                    <span className="nocodb-text">

                      <strong>
                        {nocodbUploading
                          ? "Adding to NocoDB..."
                          : nocodbUploaded
                            ? "Added to NocoDB"
                            : "Add to NocoDB"}
                      </strong>

                      <small>
                        {nocodbUploaded
                          ? "Upload complete"
                          : "Check to send these results"}
                      </small>

                    </span>

                  </label>

                </div>

              </div>


              {/* NocoDB response */}

              {nocodbMessage && (
                <div className="alert alert-success">

                  <span className="alert-symbol">
                    ✓
                  </span>

                  <span>
                    {
                      nocodbMessage
                    }
                  </span>

                </div>
              )}


              {nocodbError && (
                <div className="alert alert-error">

                  <span className="alert-symbol">
                    !
                  </span>

                  <span>
                    {
                      nocodbError
                    }
                  </span>

                </div>
              )}


              {/* =======================================
                  ARTICLES TABLE
              ======================================= */}

              <div className="table-wrap">

                <table>

                  <thead>
                    <tr>
                      <th>
                        Source
                      </th>

                      <th>
                        Date
                      </th>

                      <th>
                        Headline
                      </th>

                      <th>
                        Feature Image
                      </th>

                      <th>
                        Article
                      </th>
                    </tr>
                  </thead>


                  <tbody>

                    {results.map(
                      (
                        row,
                        index
                      ) => (
                        <tr
                          key={
                            row.articleUrl ||
                            index
                          }
                        >

                          <td>
                            <span className="source-pill">
                              {
                                row.source
                              }
                            </span>
                          </td>


                          <td className="date-cell">
                            {
                              row.articleDate
                            }
                          </td>


                          <td className="headline-cell">
                            {
                              row.headline
                            }
                          </td>


                          <td>
                            {row.featureImageUrl ? (
                              <a
                                className="table-link"
                                href={
                                  row.featureImageUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                View image
                              </a>
                            ) : (
                              <span className="empty-value">
                                —
                              </span>
                            )}
                          </td>


                          <td>
                            <a
                              className="article-button"
                              href={
                                row.articleUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              {/* Open */}
                              {row.articleUrl}
                              <span>
                                ↗
                              </span>
                            </a>
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </section>
          )}

        </div>

      </main>


      {/* =================================================
          PAGE STYLES
      ================================================= */}

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: #f3f5f8;
          }

          .scraper-page {
            min-height: 100vh;
            background:
              radial-gradient(
                circle at 90% 4%,
                rgba(54, 101, 210, 0.08),
                transparent 28%
              ),
              #f3f5f8;
            color: #172033;
            font-family:
              Inter,
              ui-sans-serif,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          .scraper-shell {
            width: min(1450px, calc(100% - 48px));
            margin: 0 auto;
          }

          .scraper-hero {
            background:
              linear-gradient(
                120deg,
                #0a1736 0%,
                #10285b 57%,
                #163979 100%
              );
            color: white;
            padding: 54px 0 98px;
            position: relative;
            overflow: hidden;
          }

          .scraper-hero::after {
            content: "";
            position: absolute;
            width: 420px;
            height: 420px;
            border-radius: 50%;
            right: -110px;
            top: -220px;
            border: 75px solid rgba(255,255,255,0.035);
          }

          .hero-content {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 50px;
            position: relative;
            z-index: 2;
          }

          .eyebrow {
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.17em;
            color: #90b6ff;
            margin-bottom: 11px;
          }

          .hero-content h1 {
            margin: 0;
            font-size: clamp(38px, 5vw, 64px);
            line-height: 1;
            letter-spacing: -0.045em;
            font-weight: 800;
          }

          .hero-content h1 span {
            color: #80a9ff;
          }

          .hero-content p {
            max-width: 670px;
            margin: 20px 0 0;
            color: #c5d0e7;
            font-size: 16px;
            line-height: 1.65;
          }

          .hero-stats {
            display: flex;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 18px;
            backdrop-filter: blur(10px);
            overflow: hidden;
            flex-shrink: 0;
          }

          .hero-stat {
            min-width: 115px;
            padding: 18px 22px;
            text-align: center;
            border-right: 1px solid rgba(255,255,255,0.1);
          }

          .hero-stat:last-child {
            border-right: 0;
          }

          .hero-stat strong {
            display: block;
            font-size: 28px;
            line-height: 1;
            margin-bottom: 7px;
          }

          .hero-stat span {
            display: block;
            color: #b9c7e0;
            font-size: 12px;
            font-weight: 600;
          }

          .content-shell {
            margin-top: -52px;
            padding-bottom: 80px;
            position: relative;
            z-index: 5;
          }

          .panel {
            background: white;
            border: 1px solid #e3e8f0;
            border-radius: 22px;
            box-shadow:
              0 12px 35px rgba(18, 35, 68, 0.055);
            margin-bottom: 24px;
            padding: 30px;
          }

          .panel-heading {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 26px;
          }

          .panel-heading > div:first-child,
          .results-top > div:first-child {
            display: flex;
            align-items: flex-start;
            gap: 15px;
          }

          .panel-heading h2,
          .results-top h2 {
            margin: 0;
            font-size: 22px;
            letter-spacing: -0.02em;
          }

          .panel-heading p,
          .results-top p {
            margin: 6px 0 0;
            color: #718096;
            font-size: 14px;
          }

          .section-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 11px;
            background: #edf3ff;
            color: #315bb6;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.04em;
            flex-shrink: 0;
          }

          .source-count {
            padding: 8px 13px;
            background: #f3f6fa;
            color: #5e6b7e;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
          }

          .textarea-wrap {
            position: relative;
          }

          .textarea-wrap textarea {
            width: 100%;
            resize: vertical;
            min-height: 190px;
            border: 1px solid #dce3ed;
            background: #fafbfd;
            border-radius: 16px;
            outline: none;
            padding: 20px 20px 38px;
            font: inherit;
            font-size: 14px;
            line-height: 1.65;
            color: #172033;
            transition:
              border-color 0.18s ease,
              box-shadow 0.18s ease,
              background 0.18s ease;
          }

          .textarea-wrap textarea:focus {
            border-color: #4b77d8;
            background: white;
            box-shadow: 0 0 0 4px rgba(75,119,216,0.1);
          }

          .textarea-caption {
            position: absolute;
            left: 20px;
            bottom: 13px;
            color: #98a3b4;
            font-size: 11px;
          }

          .controls-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 18px;
          }

          .control-card {
            border: 1px solid #e3e8ef;
            border-radius: 15px;
            padding: 17px;
            display: flex;
            align-items: center;
            gap: 15px;
            min-height: 105px;
            background: white;
          }

          .control-icon {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 13px;
            background: #f0f4fc;
            color: #345da9;
            font-size: 10px;
            font-weight: 900;
            flex-shrink: 0;
          }

          .control-body {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
            flex: 1;
          }

          .control-body strong {
            font-size: 14px;
          }

          .control-body > span {
            font-size: 12px;
            color: #8994a5;
            margin-bottom: 6px;
          }

          .file-input,
          .date-input {
            max-width: 100%;
            font: inherit;
            font-size: 13px;
          }

          .date-input {
            padding: 7px 10px;
            border: 1px solid #dce3ed;
            border-radius: 8px;
            background: #fafbfd;
            color: #172033;
          }

          .form-footer {
            margin-top: 22px;
            display: flex;
            align-items: center;
            gap: 18px;
          }

          .scrape-button {
            min-width: 190px;
            min-height: 48px;
            border: 0;
            border-radius: 12px;
            padding: 0 22px;
            cursor: pointer;
            background:
              linear-gradient(
                135deg,
                #2958bd,
                #163f94
              );
            color: white;
            font: inherit;
            font-weight: 750;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            box-shadow:
              0 8px 18px rgba(37,83,181,0.22);
            transition:
              transform 0.15s ease,
              box-shadow 0.15s ease,
              opacity 0.15s ease;
          }

          .scrape-button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow:
              0 11px 24px rgba(37,83,181,0.28);
          }

          .scrape-button:disabled {
            opacity: 0.7;
            cursor: wait;
          }

          .button-spinner,
          .mini-spinner {
            display: inline-block;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.35);
            border-top-color: white;
            animation: scraperSpin 0.8s linear infinite;
          }

          .button-spinner {
            width: 16px;
            height: 16px;
          }

          .mini-spinner {
            width: 15px;
            height: 15px;
            border-color: #d4dded;
            border-top-color: #3b66c0;
          }

          @keyframes scraperSpin {
            to {
              transform: rotate(360deg);
            }
          }

          .form-help {
            color: #8995a7;
            font-size: 12px;
          }

          .alert {
            margin-top: 18px;
            border-radius: 11px;
            padding: 12px 15px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
          }

          .alert-error {
            background: #fff3f3;
            border: 1px solid #ffd5d5;
            color: #ad3030;
          }

          .alert-success {
            background: #edf9f2;
            border: 1px solid #ccebd8;
            color: #267244;
          }

          .alert-symbol {
            width: 23px;
            height: 23px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            font-weight: 800;
            background: rgba(255,255,255,0.7);
          }

          .progress-panel {
            padding-bottom: 18px;
          }

          .panel-heading.compact {
            margin-bottom: 18px;
          }

          .progress-summary {
            display: flex;
            gap: 8px;
            align-items: center;
          }

          .progress-ok,
          .progress-failed {
            font-size: 11px;
            font-weight: 750;
            padding: 6px 10px;
            border-radius: 999px;
          }

          .progress-ok {
            background: #edf8f2;
            color: #2c7a4c;
          }

          .progress-failed {
            background: #fff1f1;
            color: #bb4242;
          }

          .status-list {
            border-top: 1px solid #edf0f4;
          }

          .status-item {
            display: grid;
            grid-template-columns: 38px minmax(250px, 1fr) minmax(240px, 0.7fr);
            gap: 14px;
            align-items: center;
            padding: 16px 4px;
            border-bottom: 1px solid #edf0f4;
          }

          .status-item:last-child {
            border-bottom: 0;
          }

          .status-marker {
            width: 31px;
            height: 31px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: #f3f5f8;
            color: #6e7a8c;
            font-weight: 800;
          }

          .status-item.done .status-marker {
            background: #eaf8f0;
            color: #258052;
          }

          .status-item.failed .status-marker {
            background: #fff0f0;
            color: #c73c3c;
          }

          .status-item.processing .status-marker {
            background: #edf3ff;
          }

          .status-main {
            min-width: 0;
          }

          .status-name {
            font-size: 14px;
            font-weight: 750;
            margin-bottom: 3px;
          }

          .status-url {
            color: #8994a5;
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .status-detail {
            text-align: right;
            min-width: 0;
          }

          .status-detail strong {
            display: block;
            font-size: 12px;
            margin-bottom: 3px;
          }

          .status-detail span {
            display: block;
            color: #7d8899;
            font-size: 11px;
            line-height: 1.45;
          }

          .status-item.failed .status-detail span {
            color: #c94a4a;
          }

          .run-summary {
            display: flex;
            align-items: center;
            padding: 20px 28px;
            margin-bottom: 24px;
            border-radius: 17px;
            background: #0e214a;
            color: white;
            box-shadow:
              0 10px 24px rgba(15,34,73,0.12);
          }

          .summary-block {
            display: flex;
            flex-direction: column;
            min-width: 150px;
          }

          .summary-block span {
            color: #aab9d6;
            font-size: 11px;
            margin-bottom: 3px;
          }

          .summary-block strong {
            font-size: 22px;
          }

          .summary-divider {
            width: 1px;
            height: 38px;
            background: rgba(255,255,255,0.12);
            margin: 0 28px;
          }

          .results-panel {
            padding: 0;
            overflow: hidden;
          }

          .results-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 28px;
            padding: 26px 30px;
            border-bottom: 1px solid #e9edf3;
          }

          .results-actions {
            display: flex;
            align-items: stretch;
            gap: 12px;
          }

          .download-button {
            border: 1px solid #d8e0eb;
            background: white;
            color: #24334b;
            border-radius: 11px;
            padding: 0 17px;
            min-height: 50px;
            font: inherit;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }

          .download-button:hover {
            background: #f7f9fc;
          }

          .download-button > span {
            font-size: 18px;
            color: #3a67bf;
          }

          .nocodb-control {
            min-height: 50px;
            min-width: 190px;
            display: flex;
            align-items: center;
            gap: 10px;
            border: 1px solid #d8e0eb;
            border-radius: 11px;
            padding: 8px 13px;
            background: #f9fafc;
            cursor: pointer;
            user-select: none;
            transition:
              border 0.15s ease,
              background 0.15s ease;
          }

          .nocodb-control:hover {
            border-color: #9db2d9;
          }

          .nocodb-control input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
          }

          .custom-check {
            width: 23px;
            height: 23px;
            flex-shrink: 0;
            border-radius: 6px;
            border: 2px solid #aeb9c8;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 13px;
            font-weight: 900;
          }

          .nocodb-control input:checked + .custom-check {
            border-color: #3266c3;
            background: #3266c3;
          }

          .nocodb-control.uploaded {
            background: #edf9f2;
            border-color: #bfe5cf;
            cursor: default;
          }

          .nocodb-control.uploaded .custom-check {
            background: #318459;
            border-color: #318459;
          }

          .nocodb-control.uploading {
            cursor: wait;
          }

          .nocodb-text {
            display: flex;
            flex-direction: column;
            line-height: 1.2;
          }

          .nocodb-text strong {
            font-size: 12px;
          }

          .nocodb-text small {
            font-size: 10px;
            color: #8a96a8;
            margin-top: 3px;
          }

          .results-panel > .alert {
            margin: 16px 30px 0;
          }

          .table-wrap {
            width: 100%;
            overflow-x: auto;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 1000px;
          }

          thead th {
            padding: 13px 18px;
            text-align: left;
            background: #f7f9fc;
            color: #697688;
            border-bottom: 1px solid #e5eaf0;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.065em;
            font-weight: 800;
          }

          tbody td {
            padding: 17px 18px;
            border-bottom: 1px solid #edf0f4;
            font-size: 13px;
            vertical-align: middle;
          }

          tbody tr:last-child td {
            border-bottom: 0;
          }

          tbody tr:hover {
            background: #fafbfd;
          }

          .source-pill {
            display: inline-block;
            background: #eef3fb;
            color: #3a5c94;
            border-radius: 7px;
            padding: 6px 9px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          }

          .date-cell {
            white-space: nowrap;
            color: #637083;
            font-weight: 650;
          }

          .headline-cell {
            width: 45%;
            font-weight: 650;
            line-height: 1.45;
            color: #1d293c;
          }

          .table-link {
            color: #3c67b9;
            font-weight: 650;
            text-decoration: none;
            white-space: nowrap;
          }

          .table-link:hover {
            text-decoration: underline;
          }

          .article-button {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 7px 10px;
            border-radius: 8px;
            background: #f1f4f9;
            color: #273750;
            text-decoration: none;
            font-size: 11px;
            font-weight: 750;
          }

          .article-button:hover {
            background: #e7edf6;
          }

          .empty-value {
            color: #aeb7c3;
          }

          @media (max-width: 900px) {
            .scraper-shell {
              width: min(100% - 28px, 1450px);
            }

            .scraper-hero {
              padding: 42px 0 85px;
            }

            .hero-content {
              flex-direction: column;
              align-items: flex-start;
            }

            .hero-stats {
              width: 100%;
            }

            .hero-stat {
              flex: 1;
              min-width: 0;
            }

            .controls-grid {
              grid-template-columns: 1fr;
            }

            .status-item {
              grid-template-columns: 36px 1fr;
            }

            .status-detail {
              grid-column: 2;
              text-align: left;
            }

            .results-top {
              flex-direction: column;
              align-items: flex-start;
            }

            .results-actions {
              width: 100%;
            }

            .download-button,
            .nocodb-control {
              flex: 1;
            }
          }

          @media (max-width: 600px) {
            .scraper-shell {
              width: calc(100% - 20px);
            }

            .panel {
              padding: 20px;
              border-radius: 17px;
            }

            .hero-content h1 {
              font-size: 39px;
            }

            .hero-stats {
              border-radius: 13px;
            }

            .hero-stat {
              padding: 14px 10px;
            }

            .hero-stat strong {
              font-size: 22px;
            }

            .panel-heading {
              flex-direction: column;
            }

            .form-footer {
              flex-direction: column;
              align-items: stretch;
            }

            .scrape-button {
              width: 100%;
            }

            .run-summary {
              align-items: stretch;
              flex-direction: column;
              gap: 13px;
            }

            .summary-block {
              flex-direction: row;
              justify-content: space-between;
              align-items: center;
              min-width: 0;
            }

            .summary-divider {
              height: 1px;
              width: 100%;
              margin: 0;
            }

            .results-top {
              padding: 22px 20px;
            }

            .results-actions {
              flex-direction: column;
            }

            .nocodb-control,
            .download-button {
              width: 100%;
              min-width: 0;
            }

            .results-panel > .alert {
              margin-left: 20px;
              margin-right: 20px;
            }
          }
        `}
      </style>
    </>
  );
}