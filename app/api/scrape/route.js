import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const maxDuration = 60;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
]);

const BAD_PATH_PARTS = [
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/login",
  "/signin",
  "/register",
  "/subscribe",
  "/search",
  "/tag/",
  "/tags/",
  "/category/",
  "/categories/",
  "/author/",
  "/authors/",
  "/team/",
  "/teams/",
  "/fixtures",
  "/results",
  "/standings",
  "/tickets",
];

const BAD_EXTENSIONS =
  /\.(pdf|zip|docx?|xlsx?|pptx?|jpg|jpeg|png|gif|webp|svg|mp4|mp3|webm)(\?|$)/i;

const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const ORGANIZATION_BY_HOST = [
  ["icc-cricket.com", "International Cricket Council"],
  ["cricket.com.au", "Cricket Australia"],
  ["ecb.co.uk", "ECB"],
  ["pcb.com.pk", "Pakistan Cricket Board"],
  ["bcci.tv", "Board of Control for Cricket in India"],
  ["cricket.co.za", "Cricket South Africa"],
  ["cplt20.com", "Caribbean Premier League"],
  ["cplt20.prezly.com", "Caribbean Premier League"],
  ["sa20.co.za", "SA20"],
  ["lords.org", "MCC"],
  ["cricketnsw.com.au", "Cricket NSW"],
  ["qldcricket.com.au", "Queensland Cricket"],
  ["saca.com.au", "SACA"],
  ["wacricket.com.au", "WA Cricket"],
  ["cricketvictoria.com.au", "Cricket Victoria"],
  ["sa20.co.za", "SA20"],
  ["theworldca.com", "World Cricketers' Association"],
  ["thepca.co.uk", "The PCA"],
  ["brisbaneheat.com.au", "Brisbane Heat"],
  ["perthscorchers.com.au", "Perth Scorchers"],
  ["sydneysixers.com.au", "Sydney Sixers"],
  ["sydneythunder.com.au", "Sydney Thunder"],
  ["melbournerenegades.com.au", "Melbourne Renegades"],
  ["adelaidestrikers.com.au", "Adelaide Strikers"],
  ["melbournestars.com.au", "Melbourne Stars"],
  ["hobarthurricanes.com.au", "Hobart Hurricanes"],
  ["chennaisuperkings.com", "Chennai Super Kings"],
  ["punjabkingsipl.in", "Punjab Kings"],
  ["sunrisershyderabad.in", "SunRisers Hyderabad"],
  ["royalchallengers.com", "RCB"],
  ["mumbaiindians.com", "Mumbai Indians"],
  ["rajasthanroyals.com", "Rajasthan Royals"],
  ["kkr.in", "KKR"],
  ["delhicapitals.in", "Delhi Capitals"],
];

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateFromParts(year, month, day) {
  const date = new Date(
    Date.UTC(year, month, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseDateText(
  input,
  now = new Date()
) {
  const text = cleanText(input);

  if (!text) {
    return null;
  }

  const lower =
    text.toLowerCase();

  let match = lower.match(
    /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/
  );

  if (match) {
    return dateFromParts(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }

  match = lower.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*,?\s*(20\d{2})\b/
  );

  if (match) {
    return dateFromParts(
      Number(match[3]),
      MONTHS[match[2]],
      Number(match[1])
    );
  }

  match = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(20\d{2})\b/
  );

  if (match) {
    return dateFromParts(
      Number(match[3]),
      MONTHS[match[1]],
      Number(match[2])
    );
  }

  match = lower.match(
    /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/
  );

  if (match) {
    const first =
      Number(match[1]);

    const second =
      Number(match[2]);

    const year =
      Number(match[3]);

    if (first > 12) {
      return dateFromParts(
        year,
        second - 1,
        first
      );
    }

    if (second > 12) {
      return dateFromParts(
        year,
        first - 1,
        second
      );
    }

    return dateFromParts(
      year,
      second - 1,
      first
    );
  }

  if (
    /\btoday\b/i.test(
      text
    )
  ) {
    return dateFromParts(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
  }

  if (
    /\byesterday\b/i.test(
      text
    )
  ) {
    const date =
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate()
        )
      );

    date.setUTCDate(
      date.getUTCDate() - 1
    );

    return date;
  }

  match = lower.match(
    /(?:^|\s)(\d+)\s*(min|mins|minute|minutes|hr|hrs|hour|hours|h|day|days|d|week|weeks|w)\b/
  );

  if (match) {
    const amount =
      Number(match[1]);

    const unit =
      match[2];

    const date =
      new Date(now);

    if (
      [
        "min",
        "mins",
        "minute",
        "minutes",
      ].includes(unit)
    ) {
      date.setUTCMinutes(
        date.getUTCMinutes() -
          amount
      );
    } else if (
      [
        "hr",
        "hrs",
        "hour",
        "hours",
        "h",
      ].includes(unit)
    ) {
      date.setUTCHours(
        date.getUTCHours() -
          amount
      );
    } else if (
      [
        "day",
        "days",
        "d",
      ].includes(unit)
    ) {
      date.setUTCDate(
        date.getUTCDate() -
          amount
      );
    } else if (
      [
        "week",
        "weeks",
        "w",
      ].includes(unit)
    ) {
      date.setUTCDate(
        date.getUTCDate() -
          amount * 7
      );
    }

    return dateFromParts(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    );
  }

  return null;
}

function isPrivateIpv4(host) {
  const parts =
    host
      .split(".")
      .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return false;
  }

  const [a, b] =
    parts;

  return (
    a === 10 ||
    a === 127 ||
    (
      a === 169 &&
      b === 254
    ) ||
    (
      a === 172 &&
      b >= 16 &&
      b <= 31
    ) ||
    (
      a === 192 &&
      b === 168
    )
  );
}

function validatePublicUrl(
  rawUrl
) {
  let url;

  try {
    url =
      new URL(rawUrl);
  } catch {
    throw new Error(
      "Invalid source URL."
    );
  }

  if (
    ![
      "http:",
      "https:",
    ].includes(
      url.protocol
    )
  ) {
    throw new Error(
      "Only HTTP and HTTPS URLs are supported."
    );
  }

  const host =
    url.hostname
      .toLowerCase();

  if (
    BLOCKED_HOSTS.has(
      host
    ) ||
    host.endsWith(
      ".local"
    ) ||
    isPrivateIpv4(
      host
    )
  ) {
    throw new Error(
      "Private/local network URLs are not supported."
    );
  }

  url.hash = "";

  return url;
}

function normalizeArticleUrl(
  href,
  sourceUrl
) {
  if (!href) {
    return null;
  }

  const trimmed =
    String(href).trim();

  if (
    trimmed.startsWith(
      "#"
    ) ||
    trimmed.startsWith(
      "mailto:"
    ) ||
    trimmed.startsWith(
      "tel:"
    ) ||
    trimmed.startsWith(
      "javascript:"
    )
  ) {
    return null;
  }

  let url;

  try {
    url =
      new URL(
        trimmed,
        sourceUrl
      );
  } catch {
    return null;
  }

  if (
    ![
      "http:",
      "https:",
    ].includes(
      url.protocol
    )
  ) {
    return null;
  }

  if (
    BAD_EXTENSIONS.test(
      url.pathname
    )
  ) {
    return null;
  }

  const sourceHost =
    new URL(
      sourceUrl
    )
      .hostname
      .replace(
        /^www\./,
        ""
      );

  const targetHost =
    url.hostname
      .replace(
        /^www\./,
        ""
      );

  const relatedHost =
    targetHost ===
      sourceHost ||
    targetHost.endsWith(
      `.${sourceHost}`
    ) ||
    sourceHost.endsWith(
      `.${targetHost}`
    );

  if (!relatedHost) {
    return null;
  }

  const lowerPath =
    url.pathname
      .toLowerCase();

  if (
    BAD_PATH_PARTS.some(
      (part) =>
        lowerPath.includes(
          part
        )
    )
  ) {
    return null;
  }

  url.hash = "";

  return url.toString();
}

function articleUrlKey(
  value,
  sourceUrl
) {
  if (!value) {
    return "";
  }

  try {
    const url =
      new URL(
        value,
        sourceUrl
      );

    url.hash = "";
    url.search = "";

    return (
      `${url.origin}${url.pathname}`
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase()
    );
  } catch {
    return "";
  }
}

function cleanHeadline(
  value
) {
  let text =
    cleanText(value);

  text =
    text.replace(
      /\s+(?:\d+\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours|h|day|days|d|week|weeks|w))\s*$/i,
      ""
    );

  text =
    text.replace(
      /\s+\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+20\d{2}\s*$/i,
      ""
    );

  text =
    text.replace(
      /^(?:media\s*release|press\s*release|online\s*media\s*zone|news|article)\s*[:\-–—|]?\s*/i,
      ""
    );

  return cleanText(
    text
  );
}

function candidateContainers(
  $,
  anchor
) {
  const output = [];
  const seen =
    new Set();

  function add(node) {
    if (
      !node ||
      seen.has(node)
    ) {
      return;
    }

    seen.add(node);
    output.push(node);
  }

  add(
    $(anchor)
      .closest(
        "article"
      )
      .get(0)
  );

  add(
    $(anchor)
      .closest("li")
      .get(0)
  );

  let current =
    anchor;

  for (
    let i = 0;
    i < 7;
    i += 1
  ) {
    current =
      $(current)
        .parent()
        .get(0);

    if (!current) {
      break;
    }

    add(current);
  }

  return output;
}

function distinctArticleLinksInside(
  $,
  container,
  sourceUrl
) {
  const links =
    new Set();

  $(container)
    .find(
      "a[href]"
    )
    .each(
      (_, link) => {
        const articleUrl =
          normalizeArticleUrl(
            $(link).attr(
              "href"
            ),
            sourceUrl
          );

        if (!articleUrl) {
          return;
        }

        links.add(
          articleUrlKey(
            articleUrl,
            sourceUrl
          )
        );
      }
    );

  return links.size;
}

function extractDateFromContainer(
  $,
  container,
  now
) {
  const pieces = [];

  const root =
    $(container);

  for (
    const attr of [
      "datetime",
      "data-date",
      "data-time",
      "data-published",
      "data-published-at",
    ]
  ) {
    const value =
      root.attr(attr);

    if (value) {
      pieces.push(
        value
      );
    }
  }

  root
    .find(
      [
        "time",
        "[class*='date']",
        "[class*='time']",
        "[class*='publish']",
        "[class*='meta']",
      ].join(", ")
    )
    .slice(0, 15)
    .each(
      (_, node) => {
        const element =
          $(node);

        for (
          const attr of [
            "datetime",
            "content",
            "data-date",
            "data-time",
            "data-published",
            "data-published-at",
          ]
        ) {
          const value =
            element.attr(
              attr
            );

          if (value) {
            pieces.push(
              value
            );
          }
        }

        const text =
          cleanText(
            element.text()
          );

        if (text) {
          pieces.push(
            text
          );
        }
      }
    );

  const fullText =
    cleanText(
      root.text()
    );

  if (
    fullText &&
    fullText.length <=
      2200
  ) {
    pieces.push(
      fullText
    );
  }

  for (
    const piece of
    pieces
  ) {
    const date =
      parseDateText(
        piece,
        now
      );

    if (date) {
      return {
        date,
        raw:
          piece,
      };
    }
  }

  return null;
}

function findHeadline(
  $,
  anchor,
  container
) {
  const insideAnchor =
    $(anchor)
      .find(
        [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "[class*='title']",
          "[class*='headline']",
        ].join(", ")
      )
      .first();

  if (
    insideAnchor.length
  ) {
    const value =
      cleanHeadline(
        insideAnchor.text()
      );

    if (
      value.length >= 8
    ) {
      return value;
    }
  }

  const heading =
    $(container)
      .find(
        [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "[class*='title']",
          "[class*='headline']",
        ].join(", ")
      )
      .filter(
        (_, node) => {
          const text =
            cleanText(
              $(node).text()
            );

          return (
            text.length >= 8 &&
            text.length <= 500
          );
        }
      )
      .first();

  if (
    heading.length
  ) {
    const value =
      cleanHeadline(
        heading.text()
      );

    if (
      value.length >= 8
    ) {
      return value;
    }
  }

  return cleanHeadline(
    $(anchor).text()
  );
}

function knownOrganizationFromUrl(
  sourceUrl
) {
  let host = "";

  try {
    host =
      new URL(
        sourceUrl
      )
        .hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );
  } catch {
    return "";
  }

  for (
    const [
      domain,
      organization,
    ]
    of ORGANIZATION_BY_HOST
  ) {
    if (
      host === domain ||
      host.endsWith(
        `.${domain}`
      )
    ) {
      return organization;
    }
  }

  return "";
}

function fallbackOrganizationFromHost(
  sourceUrl
) {
  let host;

  try {
    host =
      new URL(
        sourceUrl
      )
        .hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );
  } catch {
    return "";
  }

  const parts =
    host.split(".");

  if (
    parts.length >= 3 &&
    [
      "com",
      "org",
      "net",
      "co",
    ].includes(
      parts.at(-2)
    )
  ) {
    parts.splice(-2);
  } else {
    parts.splice(-1);
  }

  const base =
    parts.join(" ") ||
    host;

  return base
    .replace(
      /[-_]+/g,
      " "
    )
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase()
    )
    .trim();
}

function organizationNameFromPage(
  $,
  sourceUrl
) {
  const known =
    knownOrganizationFromUrl(
      sourceUrl
    );

  if (known) {
    return known;
  }

  const candidates = [
    cleanText(
      $(
        "meta[property='og:site_name']"
      ).attr("content")
    ),

    cleanText(
      $(
        "meta[name='application-name']"
      ).attr("content")
    ),

    cleanText(
      $(
        "meta[name='apple-mobile-web-app-title']"
      ).attr("content")
    ),
  ].filter(Boolean);

  if (
    candidates.length
  ) {
    return candidates[0];
  }

  return fallbackOrganizationFromHost(
    sourceUrl
  );
}

function createResultRow({
  organizationName,
  date,
  title,
  url,
}) {
  const org =
    cleanText(
      organizationName
    );

  const cleanDate =
    cleanText(date);

  const cleanTitle =
    cleanText(title);

  const cleanUrl =
    cleanText(url);

  return {
    organizationName:
      org,

    date:
      cleanDate,

    title:
      cleanTitle,

    url:
      cleanUrl,

    source:
      org,

    articleDate:
      cleanDate,

    headline:
      cleanTitle,

    articleUrl:
      cleanUrl,
  };
}

/* =========================================================
   GENERIC HTML ARTICLE PARSER
========================================================= */

function extractArticlesGeneric(
  html,
  listingUrl,
  selectedDate,
  organizationSourceUrl =
    listingUrl
) {
  const $ =
    cheerio.load(html);

  const now =
    new Date();

  const selectedStart =
    new Date(
      `${selectedDate}T00:00:00.000Z`
    );

  const organizationName =
    organizationNameFromPage(
      $,
      organizationSourceUrl
    );

  const resultsByUrl =
    new Map();

  let scannedCandidates = 0;
  let datedCandidates = 0;

  $("a[href]").each(
    (_, anchor) => {
      const articleUrl =
        normalizeArticleUrl(
          $(anchor).attr(
            "href"
          ),
          listingUrl
        );

      if (!articleUrl) {
        return;
      }

      const listingKey =
        articleUrlKey(
          listingUrl,
          listingUrl
        );

      const articleKey =
        articleUrlKey(
          articleUrl,
          listingUrl
        );

      if (
        !articleKey ||
        articleKey ===
          listingKey
      ) {
        return;
      }

      const anchorText =
        cleanText(
          $(anchor).text()
        );

      if (
        anchorText.length <
          8 ||
        anchorText.length >
          800
      ) {
        return;
      }

      scannedCandidates +=
        1;

      const containers =
        candidateContainers(
          $,
          anchor
        );

      let selectedContainer =
        null;

      let dateInfo =
        null;

      for (
        const container
        of containers
      ) {
        const text =
          cleanText(
            $(container).text()
          );

        if (
          !text ||
          text.length > 3500
        ) {
          continue;
        }

        const distinctLinks =
          distinctArticleLinksInside(
            $,
            container,
            listingUrl
          );

        if (
          distinctLinks > 10
        ) {
          continue;
        }

        const found =
          extractDateFromContainer(
            $,
            container,
            now
          );

        if (found) {
          selectedContainer =
            container;

          dateInfo =
            found;

          break;
        }
      }

      if (
        !dateInfo ||
        !selectedContainer
      ) {
        return;
      }

      datedCandidates += 1;

      if (
        dateInfo.date <
        selectedStart
      ) {
        return;
      }

      const title =
        findHeadline(
          $,
          anchor,
          selectedContainer
        );

      if (
        title.length < 8
      ) {
        return;
      }

      const row =
        createResultRow({
          organizationName,

          date:
            isoDate(
              dateInfo.date
            ),

          title,

          url:
            articleUrl,
        });

      const existing =
        resultsByUrl.get(
          articleKey
        );

      if (
        !existing ||
        row.title.length >
          existing.title.length
      ) {
        resultsByUrl.set(
          articleKey,
          row
        );
      }
    }
  );

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  let warning = "";

  if (
    datedCandidates === 0
  ) {
    warning =
      "No dated article cards were detected in the listing HTML. This site may render its article list with JavaScript or may need a site-specific adapter.";
  } else if (
    results.length === 0
  ) {
    warning =
      "The listing page was read successfully, but no detected articles were on or after the selected date.";
  }

  return {
    organizationName,

    sourceName:
      organizationName,

    scannedCandidates,

    results,

    warning,

    diagnostics: {
      adapter:
        "generic-html",

      scannedCandidates,

      datedCandidates,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   CPL ADAPTER
========================================================= */

function isCplNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    return (
      (
        host ===
          "cplt20.com" ||
        host.endsWith(
          ".cplt20.com"
        )
      ) &&
      (
        url.pathname ===
          "/news" ||
        url.pathname.startsWith(
          "/news/"
        )
      )
    );
  } catch {
    return false;
  }
}

function extractCplPrezlyArticles(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(html);

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const now =
    new Date();

  const resultsByUrl =
    new Map();

  let datedCandidates = 0;

  $(
    "h1, h2, h3, h4"
  ).each(
    (_, heading) => {
      let title =
        cleanHeadline(
          $(heading).text()
        );

      if (
        !title ||
        title.length < 8
      ) {
        return;
      }

      const lowerTitle =
        title.toLowerCase();

      if (
        [
          "latest stories",
          "categories",
          "get updates in your mailbox",
          "contact",
          "about caribbean premier league newsroom",
        ].includes(
          lowerTitle
        )
      ) {
        return;
      }

      let current =
        heading;

      let storyContainer =
        null;

      let dateInfo =
        null;

      for (
        let depth = 0;
        depth < 7 &&
        current;
        depth += 1
      ) {
        current =
          $(current)
            .parent()
            .get(0);

        if (!current) {
          break;
        }

        const containerText =
          cleanText(
            $(current).text()
          );

        if (
          !containerText ||
          containerText.length >
            2500
        ) {
          continue;
        }

        const headingsInside =
          $(current).find(
            "h1, h2, h3, h4"
          ).length;

        if (
          headingsInside > 2
        ) {
          continue;
        }

        const foundDate =
          extractDateFromContainer(
            $,
            current,
            now
          );

        if (foundDate) {
          storyContainer =
            current;

          dateInfo =
            foundDate;

          break;
        }
      }

      if (
        !storyContainer ||
        !dateInfo
      ) {
        return;
      }

      datedCandidates +=
        1;

      if (
        dateInfo.date <
        selectedStart
      ) {
        return;
      }

      let articleHref =
        $(heading)
          .closest(
            "a[href]"
          )
          .attr(
            "href"
          ) ||
        "";

      if (
        !articleHref
      ) {
        const links =
          $(storyContainer)
            .find(
              "a[href]"
            )
            .toArray();

        for (
          const link
          of links
        ) {
          const href =
            $(link).attr(
              "href"
            );

          if (!href) {
            continue;
          }

          let candidate;

          try {
            candidate =
              new URL(
                href,
                listingUrl
              );
          } catch {
            continue;
          }

          const host =
            candidate.hostname
              .toLowerCase()
              .replace(
                /^www\./,
                ""
              );

          if (
            host !==
              "cplt20.prezly.com" ||
            candidate.pathname ===
              "/" ||
            candidate.pathname.startsWith(
              "/category"
            )
          ) {
            continue;
          }

          articleHref =
            candidate.toString();

          break;
        }
      }

      if (
        !articleHref
      ) {
        return;
      }

      let articleUrl;

      try {
        articleUrl =
          new URL(
            articleHref,
            listingUrl
          ).toString();
      } catch {
        return;
      }

      const row =
        createResultRow({
          organizationName:
            "Caribbean Premier League",

          date:
            isoDate(
              dateInfo.date
            ),

          title,

          url:
            articleUrl,
        });

      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );

      const existing =
        resultsByUrl.get(
          key
        );

      if (
        !existing ||
        row.title.length >
          existing.title.length
      ) {
        resultsByUrl.set(
          key,
          row
        );
      }
    }
  );

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  return {
    organizationName:
      "Caribbean Premier League",

    sourceName:
      "Caribbean Premier League",

    scannedCandidates:
      datedCandidates,

    results,

    warning:
      results.length
        ? ""
        : "No CPL articles were found on or after the selected date.",

    diagnostics: {
      adapter:
        "cpl-prezly-heading-first",

      datedCandidates,

      articlesReturned:
        results.length,
    },
  };
}

async function scrapeCplNews(
  sourceUrl,
  sinceDate
) {
  const newsroomUrl =
    "https://cplt20.prezly.com/";

  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      newsroomUrl
    );

  const output =
    extractCplPrezlyArticles(
      html,
      finalUrl,
      sinceDate
    );

  output.diagnostics = {
    ...output.diagnostics,

    requestedUrl:
      sourceUrl,

    listingSourceUsed:
      finalUrl,
  };

  return output;
}

/* =========================================================
   SA20 ADAPTER
========================================================= */

function isSa20NewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    return (
      host ===
        "sa20.co.za" &&
      (
        url.pathname ===
          "/news" ||
        url.pathname ===
          "/news/"
      )
    );
  } catch {
    return false;
  }
}

function isSa20StoryUrl(
  value,
  listingUrl
) {
  try {
    const url =
      new URL(
        value,
        listingUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    if (
      host !==
      "sa20.co.za"
    ) {
      return false;
    }

    const parts =
      url.pathname
        .split("/")
        .filter(Boolean);

    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !==
        "news"
    ) {
      return false;
    }

    const slug =
      parts[1]
        .toLowerCase();

    const nonStorySlugs =
      new Set([
        "announcements",
        "latest",
        "all",
        "videos",
        "video",
      ]);

    return !nonStorySlugs.has(
      slug
    );
  } catch {
    return false;
  }
}

function collectSa20ArticleCandidates(
  html,
  listingUrl
) {
  const $ =
    cheerio.load(html);

  const byUrl =
    new Map();

  $("a[href]").each(
    (_, anchor) => {
      const href =
        $(anchor).attr(
          "href"
        );

      if (!href) {
        return;
      }

      let articleUrl;

      try {
        articleUrl =
          new URL(
            href,
            listingUrl
          );
      } catch {
        return;
      }

      articleUrl.hash = "";

      if (
        !isSa20StoryUrl(
          articleUrl.toString(),
          listingUrl
        )
      ) {
        return;
      }

      const key =
        articleUrlKey(
          articleUrl.toString(),
          listingUrl
        );

      if (!key) {
        return;
      }

      const anchorText =
        cleanHeadline(
          $(anchor).text()
        );

      const existing =
        byUrl.get(
          key
        );

      if (!existing) {
        byUrl.set(
          key,
          {
            url:
              articleUrl.toString(),

            fallbackTitle:
              anchorText,
          }
        );

        return;
      }

      if (
        anchorText &&
        anchorText.length >
          (
            existing.fallbackTitle ||
            ""
          ).length
      ) {
        existing.fallbackTitle =
          anchorText;
      }
    }
  );

  return [
    ...byUrl.values(),
  ];
}

function findDateInJsonLd(
  value
) {
  if (!value) {
    return "";
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of
      value
    ) {
      const found =
        findDateInJsonLd(
          item
        );

      if (found) {
        return found;
      }
    }

    return "";
  }

  if (
    typeof value !==
      "object"
  ) {
    return "";
  }

  for (
    const key of [
      "datePublished",
      "dateCreated",
      "uploadDate",
    ]
  ) {
    if (
      typeof value[key] ===
        "string" &&
      value[key]
    ) {
      return value[key];
    }
  }

  for (
    const child of
    Object.values(
      value
    )
  ) {
    const found =
      findDateInJsonLd(
        child
      );

    if (found) {
      return found;
    }
  }

  return "";
}

function extractSa20ArticleDate(
  $
) {
  const metaSelectors = [
    "meta[property='article:published_time']",
    "meta[name='article:published_time']",
    "meta[name='date']",
    "meta[name='publish-date']",
    "meta[name='publication_date']",
    "meta[itemprop='datePublished']",
  ];

  for (
    const selector of
    metaSelectors
  ) {
    const value =
      $(selector).attr(
        "content"
      ) ||
      $(selector).attr(
        "datetime"
      ) ||
      "";

    const date =
      parseDateText(
        value
      );

    if (date) {
      return date;
    }
  }

  let jsonLdDate =
    "";

  $(
    "script[type='application/ld+json']"
  ).each(
    (_, script) => {
      if (
        jsonLdDate
      ) {
        return;
      }

      const raw =
        $(script).html();

      if (!raw) {
        return;
      }

      try {
        const parsed =
          JSON.parse(
            raw
          );

        jsonLdDate =
          findDateInJsonLd(
            parsed
          );
      } catch {
        // Ignore malformed JSON-LD.
      }
    }
  );

  if (
    jsonLdDate
  ) {
    const date =
      parseDateText(
        jsonLdDate
      );

    if (date) {
      return date;
    }
  }

  const heading =
    $("h1").first();

  if (
    heading.length
  ) {
    let current =
      heading.get(0);

    for (
      let depth = 0;
      depth < 6 &&
      current;
      depth += 1
    ) {
      current =
        $(current)
          .parent()
          .get(0);

      if (!current) {
        break;
      }

      const root =
        $(current);

      const containerText =
        cleanText(
          root.text()
        );

      if (
        !containerText ||
        containerText.length >
          6000
      ) {
        continue;
      }

      const pieces = [];

      root
        .find(
          "time, [datetime], [class*='date'], [class*='publish'], [class*='meta']"
        )
        .slice(
          0,
          20
        )
        .each(
          (_, node) => {
            const element =
              $(node);

            for (
              const attr of [
                "datetime",
                "content",
                "data-date",
                "data-time",
                "data-published",
                "data-published-at",
              ]
            ) {
              const value =
                element.attr(
                  attr
                );

              if (value) {
                pieces.push(
                  value
                );
              }
            }

            const text =
              cleanText(
                element.text()
              );

            if (text) {
              pieces.push(
                text
              );
            }
          }
        );

      for (
        const piece of
        pieces
      ) {
        const date =
          parseDateText(
            piece
          );

        if (date) {
          return date;
        }
      }

      if (
        containerText.length <=
          1800
      ) {
        const date =
          parseDateText(
            containerText
          );

        if (date) {
          return date;
        }
      }
    }
  }

  const globalPieces =
    [];

  $(
    "time, [datetime], [class*='date'], [class*='publish']"
  )
    .slice(
      0,
      30
    )
    .each(
      (_, node) => {
        const element =
          $(node);

        for (
          const attr of [
            "datetime",
            "content",
            "data-date",
            "data-time",
            "data-published",
            "data-published-at",
          ]
        ) {
          const value =
            element.attr(
              attr
            );

          if (value) {
            globalPieces.push(
              value
            );
          }
        }

        const text =
          cleanText(
            element.text()
          );

        if (text) {
          globalPieces.push(
            text
          );
        }
      }
    );

  for (
    const piece of
    globalPieces
  ) {
    const date =
      parseDateText(
        piece
      );

    if (date) {
      return date;
    }
  }

  return null;
}

function extractSa20ArticleDetails(
  html,
  articleUrl,
  fallbackTitle = ""
) {
  const $ =
    cheerio.load(html);

  let title =
    cleanHeadline(
      $("h1")
        .first()
        .text()
    );

  if (!title) {
    title =
      cleanHeadline(
        $(
          "meta[property='og:title']"
        ).attr(
          "content"
        ) ||
        fallbackTitle
      );
  }

  if (
    !title ||
    title.length < 5
  ) {
    return null;
  }

  const date =
    extractSa20ArticleDate(
      $
    );

  if (!date) {
    return null;
  }

  return createResultRow({
    organizationName:
      "SA20",

    date:
      isoDate(
        date
      ),

    title,

    url:
      articleUrl,
  });
}

async function fetchHtmlForArticle(
  url,
  timeoutMs = 12000
) {
  try {
    return await fetchHtmlAttempt(
      url,
      timeoutMs
    );
  } catch (error) {
    console.log(
      `[Article fetch failed] ${url}`,
      error?.message ||
        error
    );

    return null;
  }
}

async function mapWithConcurrency(
  items,
  limit,
  mapper
) {
  const results =
    new Array(
      items.length
    );

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex =
        nextIndex;

      nextIndex += 1;

      if (
        currentIndex >=
        items.length
      ) {
        return;
      }

      results[
        currentIndex
      ] =
        await mapper(
          items[
            currentIndex
          ],
          currentIndex
        );
    }
  }

  const workerCount =
    Math.min(
      Math.max(
        1,
        limit
      ),
      items.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () =>
        worker()
    )
  );

  return results;
}

async function scrapeSa20News(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );

  const candidates =
    collectSa20ArticleCandidates(
      html,
      finalUrl
    );

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  let failedArticlePages =
    0;

  let pagesWithoutUsableDate =
    0;

  const extracted =
    await mapWithConcurrency(
      candidates,
      8,
      async (
        candidate
      ) => {
        const fetched =
          await fetchHtmlForArticle(
            candidate.url
          );

        if (!fetched) {
          failedArticlePages +=
            1;

          return null;
        }

        const row =
          extractSa20ArticleDetails(
            fetched.html,
            fetched.finalUrl ||
              candidate.url,
            candidate.fallbackTitle
          );

        if (!row) {
          pagesWithoutUsableDate +=
            1;

          return null;
        }

        const articleDate =
          new Date(
            `${row.date}T00:00:00.000Z`
          );

        if (
          articleDate <
          selectedStart
        ) {
          return null;
        }

        return row;
      }
    );

  const resultsByUrl =
    new Map();

  for (
    const row of
    extracted
  ) {
    if (!row) {
      continue;
    }

    const key =
      articleUrlKey(
        row.url,
        finalUrl
      );

    if (!key) {
      continue;
    }

    resultsByUrl.set(
      key,
      row
    );
  }

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  let warning = "";

  if (
    candidates.length === 0
  ) {
    warning =
      "No SA20 article links were detected on the news page.";
  } else if (
    results.length === 0
  ) {
    warning =
      "SA20 article links were found, but no articles on or after the selected date could be confirmed from their article pages.";
  } else if (
    failedArticlePages >
      0 ||
    pagesWithoutUsableDate >
      0
  ) {
    warning =
      `Returned ${results.length} SA20 article(s). ` +
      `${failedArticlePages} article page(s) could not be fetched and ` +
      `${pagesWithoutUsableDate} page(s) had no usable publication date.`;
  }

  return {
    organizationName:
      "SA20",

    sourceName:
      "SA20",

    scannedCandidates:
      candidates.length,

    results,

    warning,

    diagnostics: {
      adapter:
        "sa20-article-page-dates",

      listingArticleLinks:
        candidates.length,

      failedArticlePages,

      pagesWithoutUsableDate,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   PCA ADAPTER
========================================================= */

function isPcaNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    return (
      host ===
        "thepca.co.uk" &&
      (
        url.pathname ===
          "/news" ||
        url.pathname ===
          "/news/"
      )
    );
  } catch {
    return false;
  }
}

function isPcaStoryUrl(
  value,
  baseUrl =
    "https://www.thepca.co.uk/"
) {
  try {
    const url =
      new URL(
        value,
        baseUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    if (
      host !==
      "thepca.co.uk"
    ) {
      return false;
    }

    const parts =
      url.pathname
        .split("/")
        .filter(Boolean);

    if (
      parts.length !== 2
    ) {
      return false;
    }

    const root =
      parts[0]
        .toLowerCase();

    const slug =
      parts[1]
        .toLowerCase();

    if (
      ![
        "press-release",
        "members",
      ].includes(root)
    ) {
      return false;
    }

    if (
      !slug ||
      [
        "news",
        "latest",
        "all",
      ].includes(slug)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function decodePcaTitle(
  value
) {
  if (!value) {
    return "";
  }

  const $ =
    cheerio.load(
      `<div>${value}</div>`
    );

  return cleanHeadline(
    $("div").text()
  )
    .replace(
      /\s*[-|–—]\s*The PCA\s*$/i,
      ""
    )
    .trim();
}

async function fetchPcaJson(
  url,
  timeoutMs = 15000
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            "User-Agent":
              USER_AGENT,

            Accept:
              "application/json,text/plain,*/*",

            "Accept-Language":
              "en-GB,en-US;q=0.9,en;q=0.8",

            "Cache-Control":
              "no-cache",

            Pragma:
              "no-cache",
          },

          redirect:
            "follow",

          cache:
            "no-store",

          signal:
            controller.signal,
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `PCA API returned HTTP ${response.status}.`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function discoverPcaRestBases() {
  const bases =
    new Set([
      "posts",
    ]);

  let types = null;

  const typeUrls = [
    "https://www.thepca.co.uk/wp-json/wp/v2/types",
    "https://www.thepca.co.uk/?rest_route=/wp/v2/types",
  ];

  for (
    const url of
    typeUrls
  ) {
    try {
      types =
        await fetchPcaJson(
          url
        );

      if (
        types &&
        typeof types ===
          "object"
      ) {
        break;
      }
    } catch {
      // Try alternate WordPress REST form.
    }
  }

  if (
    types &&
    typeof types ===
      "object"
  ) {
    for (
      const [
        key,
        definition,
      ] of Object.entries(
        types
      )
    ) {
      const restBase =
        cleanText(
          definition?.rest_base
        );

      if (!restBase) {
        continue;
      }

      const label =
        cleanText(
          definition?.name ||
          definition?.slug ||
          key
        ).toLowerCase();

      if (
        key === "post" ||
        label.includes(
          "post"
        ) ||
        label.includes(
          "press"
        ) ||
        label.includes(
          "news"
        ) ||
        label.includes(
          "article"
        ) ||
        label.includes(
          "member"
        )
      ) {
        bases.add(
          restBase
        );
      }
    }
  }

  return [
    ...bases,
  ];
}

async function fetchPcaRestItems(
  restBase,
  sinceDate
) {
  const fields =
    encodeURIComponent(
      "id,date,date_gmt,link,slug,title,status,type"
    );

  const after =
    encodeURIComponent(
      `${sinceDate}T00:00:00`
    );

  const endpoints = [
    `https://www.thepca.co.uk/wp-json/wp/v2/${restBase}?per_page=100&orderby=date&order=desc&after=${after}&_fields=${fields}`,

    `https://www.thepca.co.uk/?rest_route=/wp/v2/${restBase}&per_page=100&orderby=date&order=desc&after=${after}&_fields=${fields}`,

    `https://www.thepca.co.uk/wp-json/wp/v2/${restBase}?per_page=100&orderby=date&order=desc&_fields=${fields}`,
  ];

  for (
    const url of
    endpoints
  ) {
    try {
      const data =
        await fetchPcaJson(
          url
        );

      if (
        Array.isArray(
          data
        )
      ) {
        return data;
      }
    } catch {
      // Try next endpoint.
    }
  }

  return [];
}

function pcaRestItemToRow(
  item
) {
  if (
    !item ||
    !item.link ||
    !isPcaStoryUrl(
      item.link
    )
  ) {
    return null;
  }

  const rawDate =
    cleanText(
      item.date ||
      item.date_gmt
    );

  const dateMatch =
    rawDate.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );

  if (!dateMatch) {
    return null;
  }

  const title =
    decodePcaTitle(
      item.title?.rendered ||
      item.title ||
      ""
    );

  if (
    !title ||
    title.length < 5
  ) {
    return null;
  }

  let url;

  try {
    const parsed =
      new URL(
        item.link
      );

    parsed.hash = "";

    url =
      parsed.toString();
  } catch {
    return null;
  }

  return createResultRow({
    organizationName:
      "The PCA",

    date:
      `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`,

    title,

    url,
  });
}

async function scrapePcaViaWordpress(
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const restBases =
    await discoverPcaRestBases();

  const allItems = [];

  for (
    const restBase of
    restBases
  ) {
    const items =
      await fetchPcaRestItems(
        restBase,
        sinceDate
      );

    for (
      const item of
      items
    ) {
      allItems.push(
        item
      );
    }
  }

  const resultsByUrl =
    new Map();

  for (
    const item of
    allItems
  ) {
    const row =
      pcaRestItemToRow(
        item
      );

    if (!row) {
      continue;
    }

    const articleDate =
      new Date(
        `${row.date}T00:00:00.000Z`
      );

    if (
      articleDate <
      selectedStart
    ) {
      continue;
    }

    const key =
      articleUrlKey(
        row.url,
        "https://www.thepca.co.uk/"
      );

    if (!key) {
      continue;
    }

    resultsByUrl.set(
      key,
      row
    );
  }

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  return {
    organizationName:
      "The PCA",

    sourceName:
      "The PCA",

    scannedCandidates:
      resultsByUrl.size,

    results,

    warning:
      results.length === 0
        ? "The PCA WordPress feed returned no matching articles for the selected date."
        : "",

    diagnostics: {
      adapter:
        "pca-wordpress-rest",

      restBases,

      apiItemsChecked:
        allItems.length,

      articlesReturned:
        results.length,
    },
  };
}

function collectPcaStoryUrlsFromHtml(
  html,
  listingUrl
) {
  const $ =
    cheerio.load(html);

  const byUrl =
    new Map();

  $("a[href]").each(
    (_, anchor) => {
      const href =
        $(anchor).attr(
          "href"
        );

      if (
        !href ||
        !isPcaStoryUrl(
          href,
          listingUrl
        )
      ) {
        return;
      }

      let absolute;

      try {
        absolute =
          new URL(
            href,
            listingUrl
          );

        absolute.hash = "";
      } catch {
        return;
      }

      const key =
        articleUrlKey(
          absolute.toString(),
          listingUrl
        );

      if (!key) {
        return;
      }

      const title =
        cleanHeadline(
          $(anchor).text()
        );

      const existing =
        byUrl.get(
          key
        );

      if (!existing) {
        byUrl.set(
          key,
          {
            url:
              absolute.toString(),

            fallbackTitle:
              title,
          }
        );

        return;
      }

      if (
        title &&
        title.length >
          (
            existing.fallbackTitle ||
            ""
          ).length
      ) {
        existing.fallbackTitle =
          title;
      }
    }
  );

  return [
    ...byUrl.values(),
  ];
}

function firstVisiblePcaDateFromBody(
  $
) {
  const bodyText =
    cleanText(
      $("body").text()
    );

  if (!bodyText) {
    return null;
  }

  const dayFirst =
    bodyText.match(
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(20\d{2})\b/i
    );

  if (dayFirst) {
    return dateFromParts(
      Number(dayFirst[3]),
      MONTHS[
        dayFirst[2]
          .toLowerCase()
      ],
      Number(dayFirst[1])
    );
  }

  const monthFirst =
    bodyText.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i
    );

  if (monthFirst) {
    return dateFromParts(
      Number(monthFirst[3]),
      MONTHS[
        monthFirst[1]
          .toLowerCase()
      ],
      Number(monthFirst[2])
    );
  }

  return null;
}

function extractPcaArticleDetails(
  html,
  articleUrl,
  fallbackTitle = ""
) {
  const $ =
    cheerio.load(html);

  let title =
    decodePcaTitle(
      $(
        "meta[property='og:title']"
      ).attr(
        "content"
      ) ||
      ""
    );

  if (!title) {
    const headings =
      $("h1")
        .toArray();

    for (
      const heading of
      headings
    ) {
      const candidate =
        decodePcaTitle(
          $(heading).text()
        );

      if (
        candidate &&
        candidate.length >= 5 &&
        candidate.toLowerCase() !==
          "the pca" &&
        candidate.toLowerCase() !==
          "press centre"
      ) {
        title =
          candidate;

        break;
      }
    }
  }

  if (!title) {
    title =
      decodePcaTitle(
        fallbackTitle
      );
  }

  if (
    !title ||
    title.length < 5
  ) {
    return null;
  }

  const date =
    firstVisiblePcaDateFromBody(
      $
    );

  if (!date) {
    return null;
  }

  return createResultRow({
    organizationName:
      "The PCA",

    date:
      isoDate(
        date
      ),

    title,

    url:
      articleUrl,
  });
}

async function scrapePcaViaArticlePages(
  sourceUrl,
  sinceDate
) {
  const sourcePages = [
    sourceUrl,
    "https://www.thepca.co.uk/category/press-release/",
  ];

  const candidatesByUrl =
    new Map();

  for (
    const pageUrl of
    sourcePages
  ) {
    try {
      const {
        html,
        finalUrl,
      } =
        await fetchHtml(
          pageUrl
        );

      const candidates =
        collectPcaStoryUrlsFromHtml(
          html,
          finalUrl
        );

      for (
        const candidate of
        candidates
      ) {
        const key =
          articleUrlKey(
            candidate.url,
            finalUrl
          );

        if (!key) {
          continue;
        }

        const existing =
          candidatesByUrl.get(
            key
          );

        if (!existing) {
          candidatesByUrl.set(
            key,
            candidate
          );
        } else if (
          candidate.fallbackTitle &&
          candidate.fallbackTitle.length >
            (
              existing.fallbackTitle ||
              ""
            ).length
        ) {
          existing.fallbackTitle =
            candidate.fallbackTitle;
        }
      }
    } catch (error) {
      console.log(
        `[PCA] Listing fallback failed: ${pageUrl}`,
        error?.message ||
          error
      );
    }
  }

  const candidates = [
    ...candidatesByUrl.values(),
  ];

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  let failedArticlePages =
    0;

  let pagesWithoutUsableDate =
    0;

  const rows =
    await mapWithConcurrency(
      candidates,
      3,
      async (
        candidate
      ) => {
        const fetched =
          await fetchHtmlForArticle(
            candidate.url,
            15000
          );

        if (!fetched) {
          failedArticlePages +=
            1;

          return null;
        }

        const row =
          extractPcaArticleDetails(
            fetched.html,
            fetched.finalUrl ||
              candidate.url,
            candidate.fallbackTitle
          );

        if (!row) {
          pagesWithoutUsableDate +=
            1;

          return null;
        }

        const articleDate =
          new Date(
            `${row.date}T00:00:00.000Z`
          );

        if (
          articleDate <
          selectedStart
        ) {
          return null;
        }

        return row;
      }
    );

  const resultsByUrl =
    new Map();

  for (
    const row of
    rows
  ) {
    if (!row) {
      continue;
    }

    const key =
      articleUrlKey(
        row.url,
        sourceUrl
      );

    if (!key) {
      continue;
    }

    resultsByUrl.set(
      key,
      row
    );
  }

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  return {
    organizationName:
      "The PCA",

    sourceName:
      "The PCA",

    scannedCandidates:
      candidates.length,

    results,

    warning:
      results.length === 0
        ? "PCA story URLs were detected, but no matching article dates could be confirmed."
        : "",

    diagnostics: {
      adapter:
        "pca-article-page-fallback",

      storyUrlsFound:
        candidates.length,

      failedArticlePages,

      pagesWithoutUsableDate,

      articlesReturned:
        results.length,
    },
  };
}

async function scrapePcaNews(
  sourceUrl,
  sinceDate
) {
  try {
    const wordpress =
      await scrapePcaViaWordpress(
        sinceDate
      );

    console.log(
      "[PCA] WordPress REST:",
      wordpress.diagnostics
    );

    if (
      wordpress.results.length >
      0
    ) {
      return wordpress;
    }
  } catch (error) {
    console.log(
      "[PCA] WordPress REST failed:",
      error?.message ||
        error
    );
  }

  const fallback =
    await scrapePcaViaArticlePages(
      sourceUrl,
      sinceDate
    );

  console.log(
    "[PCA] Article-page fallback:",
    fallback.diagnostics
  );

  return fallback;
}

/* =========================================================
   CHENNAI SUPER KINGS ADAPTER
========================================================= */

function isCskNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(sourceUrl);

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    return (
      host ===
        "chennaisuperkings.com" &&
      (
        url.pathname === "/news" ||
        url.pathname === "/news/"
      )
    );
  } catch {
    return false;
  }
}

/*
 * CSK loads the news page from its own JSON API:
 *
 * /newsapi/getNewsListWithProviderByLatest
 *
 * Example:
 *
 * ?NEWSTYPE=ALL&MINLIMIT=0&MAXLIMIT=14
 */
async function fetchCskNewsBatch(
  minLimit,
  maxLimit
) {
  const url =
    "https://www.chennaisuperkings.com" +
    "/newsapi/getNewsListWithProviderByLatest" +
    `?NEWSTYPE=ALL` +
    `&MINLIMIT=${minLimit}` +
    `&MAXLIMIT=${maxLimit}`;

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      20000
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: "GET",

          headers: {
            "User-Agent":
              USER_AGENT,

            Accept:
              "application/json, text/plain, */*",

            "Accept-Language":
              "en-GB,en-US;q=0.9,en;q=0.8",

            Referer:
              "https://www.chennaisuperkings.com/news",

            "Cache-Control":
              "no-cache",
          },

          cache:
            "no-store",

          redirect:
            "follow",

          signal:
            controller.signal,
        }
      );

    if (!response.ok) {
      throw new Error(
        `CSK news API returned HTTP ${response.status}.`
      );
    }

    const data =
      await response.json();

    if (
      !data ||
      !Array.isArray(
        data.data
      )
    ) {
      throw new Error(
        "CSK news API returned an unexpected response."
      );
    }

    return data.data;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "The Chennai Super Kings news API took too long to respond."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

function parseCskApiDate(
  value
) {
  const text =
    cleanText(value);

  if (!text) {
    return null;
  }

  /*
   * CSK returns:
   *
   * 2026-10-01T00:00:00+05:30
   * 2026-10-01T23:14:10+05:30
   *
   * We only need the displayed
   * publication date.
   */
  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );

  if (!match) {
    return null;
  }

  return dateFromParts(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}

/*
 * Convert one API news item into the
 * standard result structure used by
 * the rest of the scraper.
 */
function cskApiItemToRow(
  item
) {
  if (
    !item ||
    typeof item !==
      "object"
  ) {
    return null;
  }

  const newsId =
    cleanText(
      item.news_id
    );

  const providerId =
    cleanText(
      item.news_provider_id
    );

  const title =
    cleanHeadline(
      item.news_title
    );

  /*
   * created_on matches the date displayed
   * on the CSK news card.
   *
   * Example:
   *
   * 2026-10-01T00:00:00+05:30
   */
  const rawDate =
    cleanText(
      item.created_on ||
      item.created_date_time
    );

  const date =
  parseCskApiDate(
    rawDate
  );

  if (
    !newsId ||
    !providerId ||
    !title ||
    title.length < 5 ||
    !date
  ) {
    return null;
  }

  const articleUrl =
    "https://www.chennaisuperkings.com" +
    `/news/newsdetailspage/${encodeURIComponent(
      newsId
    )}/${encodeURIComponent(
      providerId
    )}`;

  return createResultRow({
    organizationName:
      "Chennai Super Kings",

    date:
      isoDate(date),

    title,

    url:
      articleUrl,
  });
}

async function scrapeCskNews(
  sourceUrl,
  sinceDate
) {
  /*
   * CSK API returns the latest stories first.
   *
   * The website itself requests 14 at a time:
   *
   * MINLIMIT=0
   * MAXLIMIT=14
   *
   * We paginate a few batches so the scraper
   * is still safe if the selected date is
   * several days old.
   */
  const batchSize = 14;

  const maxBatches = 5;

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let scannedItems = 0;

  let invalidItems = 0;

  let batchesFetched = 0;

  for (
    let batchIndex = 0;
    batchIndex <
    maxBatches;
    batchIndex += 1
  ) {
    const minLimit =
      batchIndex *
      batchSize;

    const maxLimit =
      minLimit +
      batchSize;

    const items =
      await fetchCskNewsBatch(
        minLimit,
        maxLimit
      );

    batchesFetched += 1;

    if (
      items.length === 0
    ) {
      break;
    }

    let oldestDateInBatch =
      null;

    for (
      const item of items
    ) {
      scannedItems += 1;

      const row =
        cskApiItemToRow(
          item
        );

      if (!row) {
        invalidItems += 1;

        continue;
      }

      const articleDate =
        new Date(
          `${row.date}T00:00:00.000Z`
        );

      if (
        !oldestDateInBatch ||
        articleDate <
          oldestDateInBatch
      ) {
        oldestDateInBatch =
          articleDate;
      }

      /*
       * Selected date is inclusive.
       *
       * If user chooses 2026-10-01,
       * October 1 and everything newer
       * should be returned.
       */
      if (
        articleDate <
        selectedStart
      ) {
        continue;
      }

      const key =
        articleUrlKey(
          row.url,
          sourceUrl
        );

      if (!key) {
        continue;
      }

      resultsByUrl.set(
        key,
        row
      );
    }

    /*
     * Because the endpoint is ordered
     * latest-first, once a batch already
     * reaches dates older than the user's
     * selected start date, we do not need
     * older batches.
     */
    if (
      oldestDateInBatch &&
      oldestDateInBatch <
        selectedStart
    ) {
      break;
    }

    /*
     * Short batch means there is no
     * additional page.
     */
    if (
      items.length <
      batchSize
    ) {
      break;
    }
  }

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  let warning = "";

  if (
    scannedItems === 0
  ) {
    warning =
      "The Chennai Super Kings news API returned no articles.";
  } else if (
    results.length === 0
  ) {
    warning =
      "Chennai Super Kings news was retrieved successfully, but no articles were on or after the selected date.";
  } else if (
    invalidItems > 0
  ) {
    warning =
      `Returned ${results.length} Chennai Super Kings article(s). ` +
      `${invalidItems} API item(s) were skipped because required fields were missing.`;
  }

  return {
    organizationName:
      "Chennai Super Kings",

    sourceName:
      "Chennai Super Kings",

    scannedCandidates:
      scannedItems,

    results,

    warning,

    diagnostics: {
      adapter:
        "csk-official-news-api",

      apiEndpoint:
        "getNewsListWithProviderByLatest",

      batchesFetched,

      apiItemsChecked:
        scannedItems,

      invalidItems,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   PUNJAB KINGS ADAPTER
========================================================= */

function isPunjabKingsNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(sourceUrl);

    const host =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    return (
      host === "punjabkingsipl.in" &&
      (
        url.pathname === "/news" ||
        url.pathname === "/news/"
      )
    );
  } catch {
    return false;
  }
}

function normalizePunjabKingsUrl(
  href
) {
  if (!href) {
    return "";
  }

  let value =
    cleanText(href);

  /*
   * Punjab Kings currently outputs links like:
   *
   * https:/www.punjabkingsipl.in/news/article-slug
   *
   * Notice only one slash after https:
   */
  value =
    value.replace(
      /^https:\/(?!\/)/i,
      "https://"
    );

  /*
   * Also support normal relative links.
   */
  try {
    const url =
      new URL(
        value,
        "https://www.punjabkingsipl.in"
      );

    url.hash = "";

    return url.toString();
  } catch {
    return "";
  }
}

function extractPunjabKingsArticles(
  html,
  sinceDate
) {
  const $ =
    cheerio.load(html);

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let articleCardsFound =
    0;

  let invalidCards =
    0;

  $("article[data-publish-date]").each(
    (_, article) => {
      articleCardsFound += 1;

      const root =
        $(article);

      /*
       * The Punjab Kings listing already exposes:
       *
       * asset-title
       * data-publish-date
       * article-link
       */
      const title =
        cleanHeadline(
          root.attr(
            "asset-title"
          ) || ""
        );

      const rawDate =
        cleanText(
          root.attr(
            "data-publish-date"
          )
        );

      const href =
        root
          .find(
            'a[id="article-link"][href]'
          )
          .first()
          .attr(
            "href"
          ) ||
        root
          .find(
            "a[href]"
          )
          .first()
          .attr(
            "href"
          ) ||
        "";

      const articleUrl =
        normalizePunjabKingsUrl(
          href
        );

      /*
       * Punjab Kings date format:
       *
       * 2026-10-05T13:41:00
       */
      const dateMatch =
        rawDate.match(
          /^(20\d{2})-(\d{2})-(\d{2})/
        );

      if (
        !title ||
        title.length < 5 ||
        !articleUrl ||
        !dateMatch
      ) {
        invalidCards += 1;
        return;
      }

      const articleDate =
        dateFromParts(
          Number(dateMatch[1]),
          Number(dateMatch[2]) - 1,
          Number(dateMatch[3])
        );

      if (!articleDate) {
        invalidCards += 1;
        return;
      }

      /*
       * Selected date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }

      const row =
        createResultRow({
          organizationName:
            "Punjab Kings",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });

      const key =
        articleUrlKey(
          articleUrl,
          "https://www.punjabkingsipl.in/news"
        );

      if (!key) {
        return;
      }

      resultsByUrl.set(
        key,
        row
      );
    }
  );

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  let warning = "";

  if (
    articleCardsFound === 0
  ) {
    warning =
      "No Punjab Kings article cards were detected in the listing HTML.";
  } else if (
    results.length === 0
  ) {
    warning =
      "Punjab Kings articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards > 0
  ) {
    warning =
      `Returned ${results.length} Punjab Kings article(s). ` +
      `${invalidCards} article card(s) were skipped because required fields were missing.`;
  }

  return {
    organizationName:
      "Punjab Kings",

    sourceName:
      "Punjab Kings",

    scannedCandidates:
      articleCardsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "punjab-kings-listing-html",

      articleCardsFound,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

async function scrapePunjabKingsNews(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );

  const output =
    extractPunjabKingsArticles(
      html,
      sinceDate
    );

  output.diagnostics = {
    ...output.diagnostics,

    requestedUrl:
      sourceUrl,

    listingSourceUsed:
      finalUrl,
  };

  return output;
}

/* =========================================================
   SUNRISERS HYDERABAD ADAPTER
========================================================= */

function isSunrisersHyderabadNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    return (
      host ===
        "sunrisershyderabad.in" &&
      (
        url.pathname ===
          "/news" ||
        url.pathname ===
          "/news/"
      )
    );
  } catch {
    return false;
  }
}

function extractSunrisersHyderabadArticles(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let articleCardsFound =
    0;

  let invalidCards =
    0;

  /*
   * SRH news structure:
   *
   * <a href="/news/article-slug">
   *   <article>
   *     ...
   *     <p>27 MAY 2026</p>
   *     <h2>Article title</h2>
   *   </article>
   * </a>
   */
  $("a[href]").each(
    (_, anchor) => {
      const root =
        $(anchor);

      const article =
        root
          .find(
            "article"
          )
          .first();

      if (
        !article.length
      ) {
        return;
      }

      const href =
        cleanText(
          root.attr(
            "href"
          )
        );

      if (
        !href
      ) {
        return;
      }

      let articleUrl;

      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );

        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );

        /*
         * Only accept actual SRH news
         * article URLs.
         */
        if (
          host !==
            "sunrisershyderabad.in" ||
          !parsed.pathname.startsWith(
            "/news/"
          ) ||
          parsed.pathname ===
            "/news/"
        ) {
          return;
        }

        parsed.hash = "";

        articleUrl =
          parsed.toString();
      } catch {
        return;
      }

      articleCardsFound +=
        1;

      /*
       * The card has one visible date
       * paragraph, for example:
       *
       * 27 MAY 2026
       */
      let rawDate =
        "";

      const paragraphs =
        article
          .find(
            "p"
          )
          .toArray();

      for (
        const paragraph
        of paragraphs
      ) {
        const text =
          cleanText(
            $(paragraph).text()
          );

        const date =
          parseDateText(
            text
          );

        if (
          date
        ) {
          rawDate =
            text;

          break;
        }
      }

      const articleDate =
        parseDateText(
          rawDate
        );

      /*
       * Title is directly inside h2.
       */
      const title =
        cleanHeadline(
          article
            .find(
              "h2"
            )
            .first()
            .text()
        );

      if (
        !articleDate ||
        !title ||
        title.length < 5
      ) {
        invalidCards +=
          1;

        return;
      }

      /*
       * Selected date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }

      const row =
        createResultRow({
          organizationName:
            "SunRisers Hyderabad",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });

      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );

      if (
        !key
      ) {
        return;
      }

      resultsByUrl.set(
        key,
        row
      );
    }
  );

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  let warning =
    "";

  if (
    articleCardsFound === 0
  ) {
    warning =
      "No SunRisers Hyderabad article cards were detected on the news page.";
  } else if (
    results.length === 0
  ) {
    warning =
      "SunRisers Hyderabad articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards > 0
  ) {
    warning =
      `Returned ${results.length} SunRisers Hyderabad article(s). ` +
      `${invalidCards} article card(s) were skipped because the title or date could not be read.`;
  }

  return {
    organizationName:
      "SunRisers Hyderabad",

    sourceName:
      "SunRisers Hyderabad",

    scannedCandidates:
      articleCardsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "sunrisers-hyderabad-listing-html",

      articleCardsFound,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

async function scrapeSunrisersHyderabadNews(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );

  const output =
    extractSunrisersHyderabadArticles(
      html,
      finalUrl,
      sinceDate
    );

  output.diagnostics = {
    ...output.diagnostics,

    requestedUrl:
      sourceUrl,

    listingSourceUsed:
      finalUrl,
  };

  return output;
}

/* =========================================================
   BANGLADESH CRICKET BOARD ADAPTER
========================================================= */

function isBcbMediaReleaseUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "tigercricket.com.bd" &&
      path ===
        "/category/media-release"
    );
  } catch {
    return false;
  }
}

function isBcbDetailUrl(
  value,
  baseUrl
) {
  try {
    const url =
      new URL(
        value,
        baseUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    return (
      host ===
        "tigercricket.com.bd" &&
      url.pathname.startsWith(
        "/detail/"
      )
    );
  } catch {
    return false;
  }
}

function collectBcbArticleCandidates(
  html,
  listingUrl
) {
  const $ =
    cheerio.load(
      html
    );

  const byUrl =
    new Map();

  /*
   * BCB listing cards look like:
   *
   * <a href="/detail/..." class="media__item">
   *   <img alt="FULL ARTICLE TITLE">
   *   <span class="media__title">
   *      truncated title...
   *   </span>
   * </a>
   *
   * The image alt is preferable because
   * the visible card title can be truncated.
   */
  $("a.media__item[href]").each(
    (_, anchor) => {
      const href =
        cleanText(
          $(anchor).attr(
            "href"
          )
        );

      if (
        !href ||
        !isBcbDetailUrl(
          href,
          listingUrl
        )
      ) {
        return;
      }

      let articleUrl;

      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );

        parsed.hash = "";

        articleUrl =
          parsed.toString();
      } catch {
        return;
      }

      const imageTitle =
        cleanHeadline(
          $(anchor)
            .find(
              "img[alt]"
            )
            .first()
            .attr(
              "alt"
            ) || ""
        );

      const visibleTitle =
        cleanHeadline(
          $(anchor)
            .find(
              ".media__title"
            )
            .first()
            .text()
        );

      const fallbackTitle =
        imageTitle ||
        visibleTitle;

      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );

      if (!key) {
        return;
      }

      const existing =
        byUrl.get(
          key
        );

      if (!existing) {
        byUrl.set(
          key,
          {
            url:
              articleUrl,

            fallbackTitle,
          }
        );

        return;
      }

      if (
        fallbackTitle &&
        fallbackTitle.length >
          (
            existing.fallbackTitle ||
            ""
          ).length
      ) {
        existing.fallbackTitle =
          fallbackTitle;
      }
    }
  );

  return [
    ...byUrl.values(),
  ];
}

function extractBcbArticleDate(
  $
) {
  /*
   * First try common metadata.
   */
  const metaSelectors = [
    "meta[property='article:published_time']",
    "meta[name='article:published_time']",
    "meta[name='date']",
    "meta[name='publish-date']",
    "meta[name='publication_date']",
    "meta[itemprop='datePublished']",
  ];

  for (
    const selector of
    metaSelectors
  ) {
    const value =
      $(selector).attr(
        "content"
      ) ||
      $(selector).attr(
        "datetime"
      ) ||
      "";

    const date =
      parseDateText(
        value
      );

    if (date) {
      return date;
    }
  }

  /*
   * Then look for explicit date/time
   * elements on the article page.
   */
  const dateElements =
    $(
      [
        "time",
        "[datetime]",
        "[class*='date']",
        "[class*='publish']",
        "[class*='post-date']",
      ].join(", ")
    )
      .slice(
        0,
        25
      )
      .toArray();

  for (
    const element of
    dateElements
  ) {
    const node =
      $(element);

    const pieces = [
      node.attr(
        "datetime"
      ),

      node.attr(
        "content"
      ),

      node.attr(
        "data-date"
      ),

      node.text(),
    ];

    for (
      const piece of
      pieces
    ) {
      const date =
        parseDateText(
          piece
        );

      if (date) {
        return date;
      }
    }
  }

  /*
   * BCB displays the date directly
   * underneath the article heading.
   *
   * Example:
   *
   * Hon'ble PM Congratulates Bangladesh Team
   * March 16, 2026
   *
   * Search only a short section around H1
   * so dates from Related Posts are not used.
   */
  const heading =
    $("h1")
      .first();

  if (
    heading.length
  ) {
    const headingText =
      cleanText(
        heading.text()
      );

    const bodyText =
      cleanText(
        $("body").text()
      );

    if (
      headingText &&
      bodyText
    ) {
      const headingIndex =
        bodyText.indexOf(
          headingText
        );

      if (
        headingIndex >= 0
      ) {
        const nearbyText =
          bodyText.slice(
            headingIndex,
            headingIndex + 1000
          );

        const date =
          parseDateText(
            nearbyText
          );

        if (date) {
          return date;
        }
      }
    }

    /*
     * Additional fallback:
     * climb a few parents around H1.
     */
    let current =
      heading.get(0);

    for (
      let depth = 0;
      depth < 6 &&
      current;
      depth += 1
    ) {
      current =
        $(current)
          .parent()
          .get(0);

      if (!current) {
        break;
      }

      const text =
        cleanText(
          $(current).text()
        );

      if (
        !text ||
        text.length >
          3500
      ) {
        continue;
      }

      const date =
        parseDateText(
          text
        );

      if (date) {
        return date;
      }
    }
  }

  return null;
}

function extractBcbArticleDetails(
  html,
  articleUrl,
  fallbackTitle = ""
) {
  const $ =
    cheerio.load(
      html
    );

  /*
   * Prefer H1 from the detail page.
   */
  let title =
    cleanHeadline(
      $("h1")
        .first()
        .text()
    );

  if (
    !title ||
    title.length < 5
  ) {
    title =
      cleanHeadline(
        $(
          "meta[property='og:title']"
        ).attr(
          "content"
        ) ||
        fallbackTitle
      );
  }

  if (
    !title ||
    title.length < 5
  ) {
    return null;
  }

  const date =
    extractBcbArticleDate(
      $
    );

  if (!date) {
    return null;
  }

  return createResultRow({
    organizationName:
      "Bangladesh Cricket Board",

    date:
      isoDate(
        date
      ),

    title,

    url:
      articleUrl,
  });
}

/*
 * Page 1 returns normal HTML.
 *
 * The site's "Load More" button requests:
 *
 * ?page=2
 * ?page=3
 *
 * Those requests return JSON containing:
 *
 * {
 *   html: "..."
 * }
 */
async function fetchBcbListingPage(
  sourceUrl,
  pageNumber
) {
  if (
    pageNumber === 1
  ) {
    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        sourceUrl
      );

    return {
      html,
      finalUrl,
    };
  }

  const pageUrl =
    new URL(
      sourceUrl
    );

  pageUrl.searchParams.set(
    "page",
    String(
      pageNumber
    )
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      20000
    );

  try {
    const response =
      await fetch(
        pageUrl.toString(),
        {
          method:
            "GET",

          headers: {
            "User-Agent":
              USER_AGENT,

            Accept:
              "application/json, text/javascript, */*; q=0.01",

            "X-Requested-With":
              "XMLHttpRequest",

            Referer:
              sourceUrl,

            "Accept-Language":
              "en-GB,en-US;q=0.9,en;q=0.8",

            "Cache-Control":
              "no-cache",
          },

          cache:
            "no-store",

          redirect:
            "follow",

          signal:
            controller.signal,
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `BCB pagination returned HTTP ${response.status}.`
      );
    }

    const data =
      await response.json();

    return {
      html:
        typeof data?.html ===
          "string"
          ? data.html
          : "",

      finalUrl:
        sourceUrl,
    };
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "The Bangladesh Cricket Board pagination request took too long to respond."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function scrapeBcbMediaReleases(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  /*
   * Usually you only search back a few days.
   * Five listing pages is a generous safety
   * limit without making the request huge.
   */
  const maxListingPages =
    5;

  const resultsByUrl =
    new Map();

  const seenUrls =
    new Set();

  let listingPagesFetched =
    0;

  let storyUrlsFound =
    0;

  let failedArticlePages =
    0;

  let pagesWithoutUsableDate =
    0;

  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    let listing;

    try {
      listing =
        await fetchBcbListingPage(
          sourceUrl,
          pageNumber
        );
    } catch (error) {
      /*
       * Page 1 is mandatory.
       * Later pagination failures should
       * not discard already found results.
       */
      if (
        pageNumber === 1
      ) {
        throw error;
      }

      console.log(
        `[BCB] Listing page ${pageNumber} failed:`,
        error?.message ||
          error
      );

      break;
    }

    listingPagesFetched +=
      1;

    if (
      !listing.html
    ) {
      break;
    }

    const candidates =
      collectBcbArticleCandidates(
        listing.html,
        listing.finalUrl
      )
        .filter(
          (candidate) => {
            const key =
              articleUrlKey(
                candidate.url,
                listing.finalUrl
              );

            if (
              !key ||
              seenUrls.has(
                key
              )
            ) {
              return false;
            }

            seenUrls.add(
              key
            );

            return true;
          }
        );

    if (
      candidates.length === 0
    ) {
      break;
    }

    storyUrlsFound +=
      candidates.length;

    const rows =
      await mapWithConcurrency(
        candidates,
        6,
        async (
          candidate
        ) => {
          const fetched =
            await fetchHtmlForArticle(
              candidate.url,
              15000
            );

          if (!fetched) {
            failedArticlePages +=
              1;

            return null;
          }

          const row =
            extractBcbArticleDetails(
              fetched.html,
              candidate.url,
              candidate.fallbackTitle
            );

          if (!row) {
            pagesWithoutUsableDate +=
              1;

            return null;
          }

          return row;
        }
      );

    let oldestConfirmedDate =
      null;

    for (
      const row of
      rows
    ) {
      if (!row) {
        continue;
      }

      const articleDate =
        new Date(
          `${row.date}T00:00:00.000Z`
        );

      if (
        !oldestConfirmedDate ||
        articleDate <
          oldestConfirmedDate
      ) {
        oldestConfirmedDate =
          articleDate;
      }

      /*
       * Date selection is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        continue;
      }

      const key =
        articleUrlKey(
          row.url,
          sourceUrl
        );

      if (!key) {
        continue;
      }

      resultsByUrl.set(
        key,
        row
      );
    }

    /*
     * The BCB listing is newest-first.
     *
     * Once the current listing page already
     * contains an article older than the
     * selected date, subsequent pages will
     * be older and can be skipped.
     */
    if (
      oldestConfirmedDate &&
      oldestConfirmedDate <
        selectedStart
    ) {
      break;
    }
  }

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  let warning =
    "";

  if (
    storyUrlsFound === 0
  ) {
    warning =
      "No Bangladesh Cricket Board media-release URLs were detected.";
  } else if (
    results.length === 0
  ) {
    warning =
      "Bangladesh Cricket Board media releases were detected, but none were on or after the selected date.";
  } else if (
    failedArticlePages >
      0 ||
    pagesWithoutUsableDate >
      0
  ) {
    warning =
      `Returned ${results.length} Bangladesh Cricket Board article(s). ` +
      `${failedArticlePages} article page(s) could not be fetched and ` +
      `${pagesWithoutUsableDate} article page(s) had no usable publication date.`;
  }

  return {
    organizationName:
      "Bangladesh Cricket Board",

    sourceName:
      "Bangladesh Cricket Board",

    scannedCandidates:
      storyUrlsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "bcb-media-release-detail-pages",

      listingPagesFetched,

      storyUrlsFound,

      failedArticlePages,

      pagesWithoutUsableDate,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   PAKISTAN CRICKET BOARD ADAPTER
========================================================= */

function isPcbPressReleaseUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "pcb.com.pk" &&
      (
        path ===
          "/press-release.html" ||
        /^\/press-release-\d+\.html$/.test(
          path
        )
      )
    );
  } catch {
    return false;
  }
}


/*
 * Browser-style headers used ONLY for PCB.
 *
 * We deliberately do not change the shared
 * fetchHtml() because other sites already work.
 */
function getPcbBrowserHeaders({
  referer = "",
  cookie = "",
} = {}) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/140.0.0.0 Safari/537.36",

    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9," +
      "image/avif,image/webp,image/apng,*/*;q=0.8," +
      "application/signed-exchange;v=b3;q=0.7",

    "Accept-Language":
      "en-US,en;q=0.9",

    "Cache-Control":
      "max-age=0",

    Pragma:
      "no-cache",

    "Upgrade-Insecure-Requests":
      "1",

    "Sec-CH-UA":
      '"Chromium";v="140", "Google Chrome";v="140", "Not=A?Brand";v="24"',

    "Sec-CH-UA-Mobile":
      "?0",

    "Sec-CH-UA-Platform":
      '"Windows"',

    "Sec-Fetch-Dest":
      "document",

    "Sec-Fetch-Mode":
      "navigate",

    "Sec-Fetch-Site":
      referer
        ? "same-origin"
        : "none",

    "Sec-Fetch-User":
      "?1",

    Priority:
      "u=0, i",

    DNT:
      "1",
  };

  if (referer) {
    headers.Referer =
      referer;
  }

  if (cookie) {
    headers.Cookie =
      cookie;
  }

  return headers;
}


/*
 * Extract simple name=value cookies from
 * a response.
 *
 * This does NOT try to bypass a JS
 * Cloudflare challenge. It only preserves
 * normal cookies the site may issue.
 */
function getPcbCookieHeader(
  response
) {
  try {
    if (
      typeof response.headers.getSetCookie ===
      "function"
    ) {
      const cookies =
        response.headers.getSetCookie();

      return cookies
        .map(
          (cookie) =>
            cookie
              .split(";")[0]
              .trim()
        )
        .filter(Boolean)
        .join("; ");
    }

    const raw =
      response.headers.get(
        "set-cookie"
      );

    if (!raw) {
      return "";
    }

    return raw
      .split(";")[0]
      .trim();
  } catch {
    return "";
  }
}


async function fetchPcbPageAttempt(
  url,
  {
    referer = "",
    cookie = "",
    timeoutMs = 25000,
  } = {}
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers:
            getPcbBrowserHeaders({
              referer,
              cookie,
            }),

          redirect:
            "follow",

          cache:
            "no-store",

          signal:
            controller.signal,
        }
      );

    const html =
      await response.text();

    return {
      response,
      html,

      finalUrl:
        response.url ||
        url,

      cookie:
        getPcbCookieHeader(
          response
        ),
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}


/*
 * PCB/Cloudflare sometimes treats a direct
 * server request differently from a browser
 * navigation.
 *
 * We first visit the PCB homepage using the
 * same browser-style fingerprint, retain any
 * normal cookies, and then request the actual
 * press-release page with the homepage as the
 * Referer.
 */
async function fetchPcbHtml(
  url
) {
  let cookie =
    "";

  /*
   * Warm up the session.
   */
  try {
    const home =
      await fetchPcbPageAttempt(
        "https://www.pcb.com.pk/",
        {
          timeoutMs:
            20000,
        }
      );

    if (
      home.cookie
    ) {
      cookie =
        home.cookie;
    }

    console.log(
      "[PCB] Homepage warm-up:",
      {
        status:
          home.response.status,

        cookieReceived:
          Boolean(
            home.cookie
          ),
      }
    );
  } catch (error) {
    /*
     * A homepage warm-up failure should not
     * stop us from trying the real page.
     */
    console.log(
      "[PCB] Homepage warm-up failed:",
      error?.message ||
        error
    );
  }

  let result;

  try {
    result =
      await fetchPcbPageAttempt(
        url,
        {
          referer:
            "https://www.pcb.com.pk/",

          cookie,

          timeoutMs:
            25000,
        }
      );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "The Pakistan Cricket Board website took too long to respond."
      );
    }

    throw error;
  }

  console.log(
    "[PCB] Press release fetch:",
    {
      status:
        result.response.status,

      finalUrl:
        result.finalUrl,

      contentLength:
        result.html.length,
    }
  );

  if (
    result.response.status ===
    403
  ) {
    throw new Error(
      "PCB returned HTTP 403 even with browser-style headers. " +
      "Cloudflare is requiring more than normal browser headers."
    );
  }

  if (
    !result.response.ok
  ) {
    throw new Error(
      `PCB returned HTTP ${result.response.status} ${result.response.statusText}.`
    );
  }

  /*
   * Sometimes Cloudflare can return HTTP 200
   * with a challenge page instead of the real
   * website.
   */
  const lowerHtml =
    result.html
      .toLowerCase();

  const looksLikeCloudflareChallenge =
    (
      lowerHtml.includes(
        "just a moment"
      ) &&
      lowerHtml.includes(
        "cloudflare"
      )
    ) ||
    lowerHtml.includes(
      "cf-chl-"
    );

  if (
    looksLikeCloudflareChallenge
  ) {
    throw new Error(
      "PCB returned a Cloudflare browser challenge instead of the press-release page."
    );
  }

  return {
    html:
      result.html,

    finalUrl:
      result.finalUrl,
  };
}


function extractPcbPressReleasePage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let articleCardsFound =
    0;

  let invalidCards =
    0;

  let oldestDate =
    null;

  /*
   * Important:
   *
   * Restrict ourselves to the MAIN press
   * release listing.
   *
   * This prevents the right sidebar's
   * "Latest" links from becoming duplicate
   * or unrelated results.
   */
  $(
    ".posts-list.listing-alt.bord > article"
  ).each(
    (_, article) => {
      articleCardsFound +=
        1;

      const root =
        $(article);

      /*
       * PCB provides the proper headline
       * link directly in .content.
       */
      const headlineLink =
        root
          .find(
            '.content > a[itemprop="name url"]'
          )
          .first();

      const title =
        cleanHeadline(
          headlineLink.text()
        );

      const href =
        cleanText(
          headlineLink.attr(
            "href"
          )
        );

      /*
       * Exact date is already provided:
       *
       * <time
       *   itemprop="datePublished"
       *   datetime="Oct 05, 2026"
       * >
       */
      const time =
        root
          .find(
            'time[itemprop="datePublished"]'
          )
          .first();

      const rawDate =
        cleanText(
          time.attr(
            "datetime"
          ) ||
          time.text()
        );

      const articleDate =
        parseDateText(
          rawDate
        );

      let articleUrl =
        "";

      try {
        if (href) {
          articleUrl =
            new URL(
              href,
              listingUrl
            ).toString();
        }
      } catch {
        articleUrl =
          "";
      }

      if (
        !title ||
        title.length < 5 ||
        !articleUrl ||
        !articleDate
      ) {
        invalidCards +=
          1;

        return;
      }

      if (
        !oldestDate ||
        articleDate <
          oldestDate
      ) {
        oldestDate =
          articleDate;
      }

      /*
       * Selected date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }

      const row =
        createResultRow({
          organizationName:
            "Pakistan Cricket Board",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });

      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );

      if (!key) {
        return;
      }

      resultsByUrl.set(
        key,
        row
      );
    }
  );

  return {
    articleCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


function getPcbListingUrl(
  pageNumber
) {
  if (
    pageNumber <= 1
  ) {
    return "https://www.pcb.com.pk/press-release.html";
  }

  return (
    "https://www.pcb.com.pk/" +
    `press-release-${pageNumber}.html`
  );
}


async function scrapePcbPressReleases(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  /*
   * You normally only go back 1–3 days.
   * Three PCB listing pages is therefore
   * more than enough as a safety margin.
   */
  const maxListingPages =
    3;

  const resultsByUrl =
    new Map();

  let pagesFetched =
    0;

  let totalCards =
    0;

  let invalidCards =
    0;

  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    const pageUrl =
      pageNumber === 1
        ? sourceUrl
        : getPcbListingUrl(
            pageNumber
          );

    const {
      html,
      finalUrl,
    } =
      await fetchPcbHtml(
        pageUrl
      );

    pagesFetched +=
      1;

    const page =
      extractPcbPressReleasePage(
        html,
        finalUrl,
        sinceDate
      );

    totalCards +=
      page.articleCardsFound;

    invalidCards +=
      page.invalidCards;

    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );

      if (!key) {
        continue;
      }

      resultsByUrl.set(
        key,
        row
      );
    }

    /*
     * PCB is newest-first.
     *
     * Once the oldest article on this page
     * is before our selected date, every
     * following page will be older.
     */
    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }

    /*
     * A normal PCB page currently contains
     * around 10 main press-release cards.
     * A short page generally means we've
     * reached the end.
     */
    if (
      page.articleCardsFound <
      10
    ) {
      break;
    }
  }

  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );

  let warning =
    "";

  if (
    totalCards === 0
  ) {
    warning =
      "PCB was loaded successfully, but no press-release article cards were detected.";
  } else if (
    results.length === 0
  ) {
    warning =
      "PCB press releases were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards > 0
  ) {
    warning =
      `Returned ${results.length} PCB article(s). ` +
      `${invalidCards} article card(s) were skipped because required fields were missing.`;
  }

  return {
    organizationName:
      "Pakistan Cricket Board",

    sourceName:
      "Pakistan Cricket Board",

    scannedCandidates:
      totalCards,

    results,

    warning,

    diagnostics: {
      adapter:
        "pcb-browser-headers",

      pagesFetched,

      articleCardsFound:
        totalCards,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   NEW ZEALAND CRICKET (NZC) ADAPTER

   Input:
   https://www.nzc.nz/news

   Example card date:
   08 October, 2026 in International News

   We extract ONLY:
   08 October, 2026

   No article-page requests required.
========================================================= */

function isNzcNewsUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    const path = url.pathname
      .replace(/\/+$/, "")
      .toLowerCase();

    return (
      host === "nzc.nz" &&
      path === "/news"
    );
  } catch {
    return false;
  }
}


/*
 * NZC examples:
 *
 * 08 October, 2026 in International News
 * 06 October, 2026 in Domestic News
 *
 * We deliberately ignore everything after the year.
 */
function parseNzcListingDate(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const match = text.match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(20\d{2})\b/i
  );

  if (!match) {
    return null;
  }

  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };

  const month =
    months[
      match[2].toLowerCase()
    ];

  if (
    month === undefined
  ) {
    return null;
  }

  return dateFromParts(
    Number(match[3]),
    month,
    Number(match[1])
  );
}


/*
 * Pagination:
 *
 * page 1:
 * https://www.nzc.nz/news
 *
 * page 2:
 * https://www.nzc.nz/news?page=2
 */
function getNzcListingUrl(
  sourceUrl,
  pageNumber
) {
  const url =
    new URL(sourceUrl);

  url.pathname =
    "/news/";

  url.search =
    "";

  if (
    pageNumber > 1
  ) {
    url.searchParams.set(
      "page",
      String(pageNumber)
    );
  }

  return url.toString();
}


function extractNzcNewsPage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(html);

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let articleCardsFound = 0;
  let datedCardsFound = 0;
  let invalidCards = 0;

  let oldestDate = null;


  /*
   * We look for links containing:
   *
   * - an h3 headline
   * - a paragraph matching:
   *   08 October, 2026 in International News
   *
   * This avoids navigation links and sidebar links.
   */
  $("main a[href]").each(
    (_, anchor) => {
      const link =
        $(anchor);

      const title =
        cleanHeadline(
          link
            .find("h3")
            .first()
            .text()
        );

      if (
        !title ||
        title.length < 5
      ) {
        return;
      }


      /*
       * Find the card paragraph containing
       * the publication date.
       */
      let rawDate =
        "";

      link
        .find("p")
        .each(
          (_, paragraph) => {
            if (rawDate) {
              return;
            }

            const text =
              cleanText(
                $(paragraph).text()
              );

            if (
              /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+20\d{2}\b/i.test(
                text
              )
            ) {
              rawDate =
                text;
            }
          }
        );


      if (!rawDate) {
        return;
      }


      articleCardsFound +=
        1;


      const articleDate =
        parseNzcListingDate(
          rawDate
        );


      if (
        !articleDate
      ) {
        invalidCards +=
          1;

        return;
      }


      datedCardsFound +=
        1;


      const href =
        cleanText(
          link.attr("href")
        );


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );

        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );

        if (
          host !== "nzc.nz"
        ) {
          invalidCards +=
            1;

          return;
        }


        /*
         * NZC article URLs are often:
         *
         * /watling-named-blackcaps-batting-coach/
         *
         * and occasionally:
         *
         * /news-items/...
         *
         * So don't require /news/ in the path.
         */
        const path =
          parsed.pathname
            .replace(/\/+$/, "")
            .toLowerCase();


        const excludedPaths =
          new Set([
            "",
            "/",
            "/news",
            "/international",
            "/domestic",
            "/corporate",
            "/archive",
          ]);


        if (
          excludedPaths.has(path)
        ) {
          invalidCards +=
            1;

          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      if (
        !oldestDate ||
        articleDate < oldestDate
      ) {
        oldestDate =
          articleDate;
      }


      /*
       * Inclusive selected date.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "New Zealand Cricket",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    datedCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


async function scrapeNzcNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  /*
   * NZC currently has 20 articles
   * on each listing page.
   *
   * 5 pages is more than enough for
   * your normal recent-date searches.
   */
  const maxPages =
    5;


  const resultsByUrl =
    new Map();

  let pagesFetched = 0;

  let articleCardsFound = 0;

  let datedCardsFound = 0;

  let invalidCards = 0;


  for (
    let pageNumber = 1;
    pageNumber <= maxPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getNzcListingUrl(
        sourceUrl,
        pageNumber
      );


    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );


    pagesFetched +=
      1;


    const page =
      extractNzcNewsPage(
        html,
        finalUrl,
        sinceDate
      );


    articleCardsFound +=
      page.articleCardsFound;

    datedCardsFound +=
      page.datedCardsFound;

    invalidCards +=
      page.invalidCards;


    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );


      if (!key) {
        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * No article cards means we've
     * reached the end.
     */
    if (
      page.articleCardsFound === 0
    ) {
      break;
    }


    /*
     * NZC is newest-first.
     *
     * If this page already contains
     * an article older than our selected
     * date, later pages are unnecessary.
     */
    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    articleCardsFound === 0
  ) {
    warning =
      "No New Zealand Cricket news cards were detected.";
  } else if (
    datedCardsFound === 0
  ) {
    warning =
      "NZC articles were detected, but their publication dates could not be extracted.";
  } else if (
    results.length === 0
  ) {
    warning =
      "NZC articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards > 0
  ) {
    warning =
      `Returned ${results.length} NZC article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "New Zealand Cricket",

    sourceName:
      "New Zealand Cricket",

    scannedCandidates:
      datedCardsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "nzc-exact-listing-date",

      pagesFetched,

      articleCardsFound,

      datedCardsFound,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   CRICKET WEST INDIES ADAPTER
========================================================= */

function isCwiNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "windiescricket.com" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


function isCwiArticleUrl(
  value,
  baseUrl =
    "https://www.windiescricket.com/news/"
) {
  try {
    const url =
      new URL(
        value,
        baseUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    if (
      host !==
      "windiescricket.com"
    ) {
      return false;
    }

    const parts =
      url.pathname
        .split("/")
        .filter(Boolean);

    /*
     * Actual news articles:
     *
     * /news/article-slug/
     *
     * Exclude category pages such as:
     *
     * /news/category/press-release/
     */
    return (
      parts.length === 2 &&
      parts[0].toLowerCase() ===
        "news" &&
      parts[1].toLowerCase() !==
        "category"
    );
  } catch {
    return false;
  }
}


function collectCwiArticleCandidates(
  html,
  listingUrl
) {
  const $ =
    cheerio.load(
      html
    );

  const byUrl =
    new Map();

  /*
   * CWI listing structure:
   *
   * <div class="wi-card">
   *   ...
   *   <h4 class="wi-card-title">
   *     <a href="/news/article-slug/">
   *       Article title
   *     </a>
   *   </h4>
   * </div>
   */
  $(".wi-news .wi-card").each(
    (_, card) => {
      const root =
        $(card);

      const link =
        root
          .find(
            ".wi-card-title a[href]"
          )
          .first();

      if (
        !link.length
      ) {
        return;
      }

      const href =
        cleanText(
          link.attr(
            "href"
          )
        );

      if (
        !href ||
        !isCwiArticleUrl(
          href,
          listingUrl
        )
      ) {
        return;
      }

      const title =
        cleanHeadline(
          link.text()
        );

      if (
        !title ||
        title.length < 5
      ) {
        return;
      }

      let articleUrl;

      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );

        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        return;
      }

      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );

      if (!key) {
        return;
      }

      byUrl.set(
        key,
        {
          url:
            articleUrl,

          fallbackTitle:
            title,
        }
      );
    }
  );

  return [
    ...byUrl.values(),
  ];
}


function extractCwiArticleDate(
  $,
  fallbackTitle = ""
) {
  /*
   * First try publication metadata.
   */
  const metaSelectors = [
    "meta[property='article:published_time']",
    "meta[name='article:published_time']",
    "meta[name='date']",
    "meta[name='publish-date']",
    "meta[name='publication_date']",
    "meta[itemprop='datePublished']",
  ];

  for (
    const selector of
    metaSelectors
  ) {
    const value =
      $(selector).attr(
        "content"
      ) ||
      $(selector).attr(
        "datetime"
      ) ||
      "";

    const date =
      parseDateText(
        value
      );

    if (date) {
      return date;
    }
  }


  /*
   * Reuse your existing JSON-LD helper.
   */
  let jsonLdDate =
    "";

  $(
    "script[type='application/ld+json']"
  ).each(
    (_, script) => {
      if (
        jsonLdDate
      ) {
        return;
      }

      const raw =
        $(script).html();

      if (!raw) {
        return;
      }

      try {
        const parsed =
          JSON.parse(
            raw
          );

        jsonLdDate =
          findDateInJsonLd(
            parsed
          );
      } catch {
        // Ignore malformed JSON-LD.
      }
    }
  );

  if (
    jsonLdDate
  ) {
    const date =
      parseDateText(
        jsonLdDate
      );

    if (date) {
      return date;
    }
  }


  /*
   * Article pages display the date directly
   * below the headline, for example:
   *
   * Oct. 5, 2026, 8:59 p.m.
   *
   * Since the page also contains fixtures
   * and results with many other dates, we
   * intentionally search close to the
   * article title first.
   */
  const bodyText =
    cleanText(
      $("body").text()
    );

  const cleanTitle =
    cleanText(
      fallbackTitle
    );

  if (
    bodyText &&
    cleanTitle
  ) {
    const titleIndex =
      bodyText
        .toLowerCase()
        .indexOf(
          cleanTitle
            .toLowerCase()
        );

    if (
      titleIndex >= 0
    ) {
      const nearbyText =
        bodyText.slice(
          titleIndex,
          titleIndex + 700
        );

      const date =
        parseDateText(
          nearbyText
        );

      if (date) {
        return date;
      }
    }
  }


  /*
   * Try date-related elements before using
   * any broad body fallback.
   */
  const dateNodes =
    $(
      [
        "time",
        "[datetime]",
        "[class*='date']",
        "[class*='publish']",
        "[class*='timestamp']",
      ].join(", ")
    )
      .slice(
        0,
        30
      )
      .toArray();

  for (
    const node of
    dateNodes
  ) {
    const element =
      $(node);

    const pieces = [
      element.attr(
        "datetime"
      ),

      element.attr(
        "content"
      ),

      element.attr(
        "data-date"
      ),

      element.text(),
    ];

    for (
      const piece of
      pieces
    ) {
      const date =
        parseDateText(
          piece
        );

      if (date) {
        return date;
      }
    }
  }

  return null;
}


function extractCwiArticleDetails(
  html,
  articleUrl,
  fallbackTitle
) {
  const $ =
    cheerio.load(
      html
    );

  const date =
    extractCwiArticleDate(
      $,
      fallbackTitle
    );

  if (!date) {
    return null;
  }

  /*
   * The listing already gives us a clean
   * title, so there is no need to depend
   * on the article-page heading.
   */
  let title =
    cleanHeadline(
      fallbackTitle
    );

  if (
    !title ||
    title.length < 5
  ) {
    title =
      cleanHeadline(
        $(
          "meta[property='og:title']"
        ).attr(
          "content"
        ) ||
        $("h1")
          .first()
          .text()
      );
  }

  if (
    !title ||
    title.length < 5
  ) {
    return null;
  }

  return createResultRow({
    organizationName:
      "Cricket West Indies",

    date:
      isoDate(
        date
      ),

    title,

    url:
      articleUrl,
  });
}


function getCwiListingUrl(
  sourceUrl,
  pageNumber
) {
  const url =
    new URL(
      sourceUrl
    );

  /*
   * CWI pagination:
   *
   * /news/
   * /news/?p=2
   * /news/?p=3
   */
  if (
    pageNumber <= 1
  ) {
    url.searchParams.delete(
      "p"
    );
  } else {
    url.searchParams.set(
      "p",
      String(
        pageNumber
      )
    );
  }

  return url.toString();
}


async function scrapeCwiNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  /*
   * Usually you only search the previous
   * few days. Five pages gives us plenty
   * of safety without crawling hundreds
   * of historical pages.
   */
  const maxListingPages =
    5;

  const resultsByUrl =
    new Map();

  const seenUrls =
    new Set();

  let listingPagesFetched =
    0;

  let storyUrlsFound =
    0;

  let failedArticlePages =
    0;

  let pagesWithoutUsableDate =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getCwiListingUrl(
        sourceUrl,
        pageNumber
      );

    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );

    listingPagesFetched +=
      1;

    const candidates =
      collectCwiArticleCandidates(
        html,
        finalUrl
      )
        .filter(
          (
            candidate
          ) => {
            const key =
              articleUrlKey(
                candidate.url,
                finalUrl
              );

            if (
              !key ||
              seenUrls.has(
                key
              )
            ) {
              return false;
            }

            seenUrls.add(
              key
            );

            return true;
          }
        );


    if (
      candidates.length === 0
    ) {
      break;
    }


    storyUrlsFound +=
      candidates.length;


    /*
     * Fetch detail pages concurrently.
     *
     * We only need them for the date.
     */
    const rows =
      await mapWithConcurrency(
        candidates,
        6,
        async (
          candidate
        ) => {
          const fetched =
            await fetchHtmlForArticle(
              candidate.url,
              15000
            );

          if (
            !fetched
          ) {
            failedArticlePages +=
              1;

            return null;
          }

          const row =
            extractCwiArticleDetails(
              fetched.html,
              fetched.finalUrl ||
                candidate.url,
              candidate.fallbackTitle
            );

          if (
            !row
          ) {
            pagesWithoutUsableDate +=
              1;

            return null;
          }

          return row;
        }
      );


    let oldestConfirmedDate =
      null;


    for (
      const row of
      rows
    ) {
      if (
        !row
      ) {
        continue;
      }

      const articleDate =
        new Date(
          `${row.date}T00:00:00.000Z`
        );


      if (
        !oldestConfirmedDate ||
        articleDate <
          oldestConfirmedDate
      ) {
        oldestConfirmedDate =
          articleDate;
      }


      /*
       * Selected date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        continue;
      }


      const key =
        articleUrlKey(
          row.url,
          sourceUrl
        );

      if (!key) {
        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * CWI listing is newest-first.
     *
     * If this page already reaches dates
     * before the selected date, there is
     * no reason to request page 2/3/etc.
     */
    if (
      oldestConfirmedDate &&
      oldestConfirmedDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";

  if (
    storyUrlsFound === 0
  ) {
    warning =
      "No Cricket West Indies news article URLs were detected.";
  } else if (
    results.length === 0
  ) {
    warning =
      "Cricket West Indies articles were detected, but none were on or after the selected date.";
  } else if (
    failedArticlePages >
      0 ||
    pagesWithoutUsableDate >
      0
  ) {
    warning =
      `Returned ${results.length} Cricket West Indies article(s). ` +
      `${failedArticlePages} article page(s) could not be fetched and ` +
      `${pagesWithoutUsableDate} article page(s) had no usable publication date.`;
  }


  return {
    organizationName:
      "Cricket West Indies",

    sourceName:
      "Cricket West Indies",

    scannedCandidates:
      storyUrlsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "cwi-article-page-dates",

      listingPagesFetched,

      storyUrlsFound,

      failedArticlePages,

      pagesWithoutUsableDate,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   ZIMBABWE CRICKET ADAPTER
========================================================= */

function isZimbabweCricketNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "zimcricket.org" &&
      path ===
        "/media/news"
    );
  } catch {
    return false;
  }
}


/*
 * The API returns dates such as:
 *
 * 2026-10-06T11:17:00.000Z
 *
 * We parse the YYYY-MM-DD portion directly.
 *
 * This avoids the ISO-date issue that the
 * generic parseDateText() can have when the
 * date is immediately followed by "T".
 */
function parseZimbabweApiDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }

  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );

  if (!match) {
    return null;
  }

  return dateFromParts(
    Number(
      match[1]
    ),
    Number(
      match[2]
    ) - 1,
    Number(
      match[3]
    )
  );
}


/*
 * Public Zimbabwe Cricket article URLs follow:
 *
 * /news/5187/Zimbabwe-Cricket-confirms-clubs-for-eight-African-players-in-2026-NPL-T20-Blast
 *
 * The API gives us the numeric ID and title,
 * so we can construct the public URL directly.
 */
function slugifyZimbabweNewsTitle(
  title
) {
  return cleanText(
    title
  )
    .normalize(
      "NFKD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[’']/g,
      ""
    )
    .replace(
      /&/g,
      "and"
    )
    .replace(
      /[^a-zA-Z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}


function createZimbabweArticleUrl(
  item
) {
  const id =
    Number(
      item?.association_news_id
    );

  const title =
    cleanHeadline(
      item?.news_title ||
      item?.app_title ||
      ""
    );

  if (
    !Number.isInteger(
      id
    ) ||
    id <= 0 ||
    !title
  ) {
    return "";
  }

  const slug =
    slugifyZimbabweNewsTitle(
      title
    );

  if (!slug) {
    return "";
  }

  return (
    "https://www.zimcricket.org/news/" +
    `${id}/${slug}`
  );
}


async function fetchZimbabweNewsApi(
  sourceUrl
) {
  const apiUrl =
    "https://cricheroes.in/api/your-web/news/get-news-data/-1" +
    "?page_size=undefined&news_category=undefined";

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      20000
    );

  try {
    const response =
      await fetch(
        apiUrl,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json, text/plain, */*",

            "Accept-Language":
              "en-GB,en-US;q=0.9,en;q=0.8",

            /*
             * These custom headers are sent
             * by the Zimbabwe Cricket website.
             */
            "Api-Key":
              "cr!CkH3r0s",

            "App-Id":
              "704",

            "App-Name":
              "zimbabwe_cricket",

            "App-Version":
              "0.1.0",

            "App-Version-Code":
              "100",

            "Device-Type":
              "your-web",

            "Udid":
              "38b16f7d3a5094ea6cb9e1b6d833f57c",

            Origin:
              "https://www.zimcricket.org",

            Referer:
              "https://www.zimcricket.org/",

            "User-Agent":
              "Mozilla/5.0 (Linux; Android 16; Pixel 10) " +
              "AppleWebKit/537.36 (KHTML, like Gecko) " +
              "Chrome/154.0.0.0 Mobile Safari/537.36",

            "Cache-Control":
              "no-cache",
          },

          cache:
            "no-store",

          redirect:
            "follow",

          signal:
            controller.signal,
        }
      );

    const rawText =
      await response.text();

    if (
      !response.ok
    ) {
      throw new Error(
        `Zimbabwe Cricket API returned HTTP ${response.status}.`
      );
    }

    let data;

    try {
      data =
        JSON.parse(
          rawText
        );
    } catch {
      throw new Error(
        "Zimbabwe Cricket API did not return valid JSON."
      );
    }

    /*
     * Useful diagnostics if the API
     * changes again later.
     */
    console.log(
      "[Zimbabwe Cricket API]",
      {
        httpStatus:
          response.status,

        status:
          data?.status,

        items:
          Array.isArray(
            data?.data
          )
            ? data.data.length
            : 0,

        message:
          data?.message ||
          "",
      }
    );

    if (
      data?.status !==
        true ||
      !Array.isArray(
        data?.data
      )
    ) {
      console.log(
        "[Zimbabwe Cricket API unexpected response]",
        data
      );

      throw new Error(
        "Zimbabwe Cricket API returned an unexpected response format."
      );
    }

    return {
      apiUrl,

      items:
        data.data,
    };
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Zimbabwe Cricket API took too long to respond."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}



async function scrapeZimbabweCricketNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const {
    apiUrl,
    items,
  } =
    await fetchZimbabweNewsApi(
      sourceUrl
    );

  const resultsByUrl =
    new Map();

  let eligibleCategoryItems =
    0;

  let invalidItems =
    0;

  let internationalItems =
    0;

  let domesticItems =
    0;


  for (
    const item of
    items
  ) {
    const category =
      cleanText(
        item?.category_name
      ).toUpperCase();


    /*
     * User wants BOTH:
     *
     * INTERNATIONAL
     * DOMESTIC
     *
     * Ignore any other categories returned
     * by the API.
     */
    if (
      category !==
        "INTERNATIONAL" &&
      category !==
        "DOMESTIC"
    ) {
      continue;
    }


    eligibleCategoryItems +=
      1;


    if (
      category ===
      "INTERNATIONAL"
    ) {
      internationalItems +=
        1;
    }

    if (
      category ===
      "DOMESTIC"
    ) {
      domesticItems +=
        1;
    }


    const title =
      cleanHeadline(
        item?.news_title ||
        item?.app_title ||
        ""
      );


    const articleDate =
      parseZimbabweApiDate(
        item?.news_date
      );


    const articleUrl =
      createZimbabweArticleUrl(
        item
      );


    if (
      !title ||
      title.length < 5 ||
      !articleDate ||
      !articleUrl
    ) {
      invalidItems +=
        1;

      continue;
    }


    /*
     * Selected date is inclusive.
     */
    if (
      articleDate <
      selectedStart
    ) {
      continue;
    }


    const row =
      createResultRow({
        organizationName:
          "Zimbabwe Cricket",

        date:
          isoDate(
            articleDate
          ),

        title,

        url:
          articleUrl,
      });


    const key =
      articleUrlKey(
        articleUrl,
        sourceUrl
      );


    if (!key) {
      invalidItems +=
        1;

      continue;
    }


    resultsByUrl.set(
      key,
      row
    );
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";

  if (
    items.length ===
    0
  ) {
    warning =
      "Zimbabwe Cricket API returned no news items.";
  } else if (
    eligibleCategoryItems ===
    0
  ) {
    warning =
      "Zimbabwe Cricket news was returned, but no International or Domestic articles were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Zimbabwe Cricket International and Domestic articles were detected, but none were on or after the selected date.";
  } else if (
    invalidItems > 0
  ) {
    warning =
      `Returned ${results.length} Zimbabwe Cricket article(s). ` +
      `${invalidItems} item(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Zimbabwe Cricket",

    sourceName:
      "Zimbabwe Cricket",

    scannedCandidates:
      eligibleCategoryItems,

    results,

    warning,

    diagnostics: {
      adapter:
        "zimbabwe-cricket-api",

      apiUrl,

      apiItemsReturned:
        items.length,

      eligibleCategoryItems,

      internationalItems,

      domesticItems,

      invalidItems,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   KARACHI KINGS ADAPTER
========================================================= */

function isKarachiKingsNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "karachikings.com.pk" &&
      path ===
        "/category/news"
    );
  } catch {
    return false;
  }
}


function extractKarachiKingsNewsPage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let articleCardsFound =
    0;

  let invalidCards =
    0;

  let oldestDate =
    null;


  /*
   * Karachi Kings article structure:
   *
   * <article class="... btArticleListItem ... category-news">
   *
   *   <h2>
   *     <a href="ARTICLE URL">
   *       ARTICLE TITLE
   *     </a>
   *   </h2>
   *
   *   <span class="btArticleDate">
   *     May 6, 2026
   *   </span>
   *
   * </article>
   */
  $("article.btArticleListItem.category-news").each(
    (_, article) => {
      articleCardsFound +=
        1;

      const root =
        $(article);

      const headlineLink =
        root
          .find(
            ".btArticleHeadline h2 a[href]"
          )
          .first();

      const title =
        cleanHeadline(
          headlineLink.text()
        );

      const href =
        cleanText(
          headlineLink.attr(
            "href"
          )
        );

      const rawDate =
        cleanText(
          root
            .find(
              ".btArticleDate"
            )
            .first()
            .text()
        );

      const articleDate =
        parseDateText(
          rawDate
        );

      let articleUrl =
        "";

      try {
        if (href) {
          const parsed =
            new URL(
              href,
              listingUrl
            );

          const host =
            parsed.hostname
              .toLowerCase()
              .replace(
                /^www\./,
                ""
              );

          if (
            host !==
            "karachikings.com.pk"
          ) {
            invalidCards +=
              1;

            return;
          }

          parsed.hash =
            "";

          articleUrl =
            parsed.toString();
        }
      } catch {
        articleUrl =
          "";
      }


      if (
        !title ||
        title.length < 5 ||
        !articleUrl ||
        !articleDate
      ) {
        invalidCards +=
          1;

        return;
      }


      if (
        !oldestDate ||
        articleDate <
          oldestDate
      ) {
        oldestDate =
          articleDate;
      }


      /*
       * Selected date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Karachi Kings",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );

      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


function getKarachiKingsListingUrl(
  sourceUrl,
  pageNumber
) {
  const base =
    new URL(
      sourceUrl
    );

  if (
    pageNumber <= 1
  ) {
    base.pathname =
      "/category/news/";

    base.search =
      "";

    return base.toString();
  }

  base.pathname =
    `/category/news/page/${pageNumber}/`;

  base.search =
    "";

  return base.toString();
}


async function scrapeKarachiKingsNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  /*
   * You normally search only a few
   * days back. Five pages gives plenty
   * of room if posting frequency rises.
   */
  const maxListingPages =
    5;

  const resultsByUrl =
    new Map();

  let pagesFetched =
    0;

  let totalCards =
    0;

  let invalidCards =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getKarachiKingsListingUrl(
        sourceUrl,
        pageNumber
      );

    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );

    pagesFetched +=
      1;


    const page =
      extractKarachiKingsNewsPage(
        html,
        finalUrl,
        sinceDate
      );


    totalCards +=
      page.articleCardsFound;

    invalidCards +=
      page.invalidCards;


    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );

      if (!key) {
        continue;
      }

      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * No cards means we have reached
     * the end of available pagination.
     */
    if (
      page.articleCardsFound ===
      0
    ) {
      break;
    }


    /*
     * The archive is newest first.
     *
     * Once this page contains an article
     * older than the user's selected date,
     * every subsequent page will also be
     * older.
     */
    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";

  if (
    totalCards === 0
  ) {
    warning =
      "No Karachi Kings news article cards were detected.";
  } else if (
    results.length === 0
  ) {
    warning =
      "Karachi Kings articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards > 0
  ) {
    warning =
      `Returned ${results.length} Karachi Kings article(s). ` +
      `${invalidCards} article card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Karachi Kings",

    sourceName:
      "Karachi Kings",

    scannedCandidates:
      totalCards,

    results,

    warning,

    diagnostics: {
      adapter:
        "karachi-kings-listing-html",

      pagesFetched,

      articleCardsFound:
        totalCards,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   LAHORE QALANDARS ADAPTER
========================================================= */

function isLahoreQalandarsNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "lahoreqalandars.com" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


/*
 * Lahore Qalandars uses dated
 * WordPress permalinks:
 *
 * /2026/07/08/article-slug/
 */
function extractLahoreQalandarsDateFromUrl(
  articleUrl
) {
  try {
    const url =
      new URL(
        articleUrl
      );

    const match =
      url.pathname.match(
        /^\/(20\d{2})\/(\d{2})\/(\d{2})\//
      );

    if (!match) {
      return null;
    }

    return dateFromParts(
      Number(
        match[1]
      ),
      Number(
        match[2]
      ) - 1,
      Number(
        match[3]
      )
    );
  } catch {
    return null;
  }
}


function extractLahoreQalandarsNewsPage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let articleCardsFound =
    0;

  let invalidCards =
    0;

  let oldestDate =
    null;


  /*
   * Only use the main blog grid.
   *
   * Do NOT use the top slider because
   * it duplicates the newest articles.
   */
  $(".et_pb_blog_grid article.et_pb_post").each(
    (_, article) => {
      articleCardsFound +=
        1;

      const root =
        $(article);

      const headlineLink =
        root
          .find(
            "h4.entry-title a[href]"
          )
          .first();

      const title =
        cleanHeadline(
          headlineLink.text()
        );

      const href =
        cleanText(
          headlineLink.attr(
            "href"
          )
        );

      let articleUrl =
        "";

      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );

        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );

        if (
          host !==
          "lahoreqalandars.com"
        ) {
          invalidCards +=
            1;

          return;
        }

        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      const articleDate =
        extractLahoreQalandarsDateFromUrl(
          articleUrl
        );


      if (
        !title ||
        title.length < 5 ||
        !articleUrl ||
        !articleDate
      ) {
        invalidCards +=
          1;

        return;
      }


      if (
        !oldestDate ||
        articleDate <
          oldestDate
      ) {
        oldestDate =
          articleDate;
      }


      /*
       * Selected date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Lahore Qalandars",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );

      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


function getLahoreQalandarsListingUrl(
  sourceUrl,
  pageNumber
) {
  const base =
    new URL(
      sourceUrl
    );

  if (
    pageNumber <= 1
  ) {
    base.pathname =
      "/news/";

    base.search =
      "";

    return base.toString();
  }

  base.pathname =
    `/news/page/${pageNumber}/`;

  base.search =
    "?et_blog";

  return base.toString();
}


async function scrapeLahoreQalandarsNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const maxListingPages =
    5;

  const resultsByUrl =
    new Map();

  let pagesFetched =
    0;

  let totalCards =
    0;

  let invalidCards =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getLahoreQalandarsListingUrl(
        sourceUrl,
        pageNumber
      );

    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );

    pagesFetched +=
      1;


    const page =
      extractLahoreQalandarsNewsPage(
        html,
        finalUrl,
        sinceDate
      );


    totalCards +=
      page.articleCardsFound;

    invalidCards +=
      page.invalidCards;


    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );

      if (!key) {
        continue;
      }

      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * No cards means pagination
     * has ended.
     */
    if (
      page.articleCardsFound ===
      0
    ) {
      break;
    }


    /*
     * Posts are newest first.
     *
     * Once we reach a page containing
     * a post older than the selected
     * date, later pages can be skipped.
     */
    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";

  if (
    totalCards === 0
  ) {
    warning =
      "No Lahore Qalandars news article cards were detected.";
  } else if (
    results.length === 0
  ) {
    warning =
      "Lahore Qalandars articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards > 0
  ) {
    warning =
      `Returned ${results.length} Lahore Qalandars article(s). ` +
      `${invalidCards} article card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Lahore Qalandars",

    sourceName:
      "Lahore Qalandars",

    scannedCandidates:
      totalCards,

    results,

    warning,

    diagnostics: {
      adapter:
        "lahore-qalandars-listing-html",

      pagesFetched,

      articleCardsFound:
        totalCards,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   CRICKET SCOTLAND ADAPTER
========================================================= */

function isCricketScotlandNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "cricketscotland.com" &&
      path ===
        "/explore/news"
    );
  } catch {
    return false;
  }
}


function parseCricketScotlandDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }

  /*
   * Example:
   *
   * 2026-10-02T13:27:00
   */
  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );

  if (!match) {
    return null;
  }

  return dateFromParts(
    Number(
      match[1]
    ),
    Number(
      match[2]
    ) - 1,
    Number(
      match[3]
    )
  );
}


/*
 * Cricket Scotland embeds its CMS data
 * inside Next.js RSC payloads like:
 *
 * self.__next_f.push([1, "..."])
 *
 * This extracts and decodes those strings.
 */
function extractCricketScotlandRscPayloads(
  html
) {
  const payloads =
    [];

  const pattern =
    /self\.__next_f\.push\(\[1,\s*("(?:\\.|[^"\\])*")\]\)/gs;

  let match;

  while (
    (
      match =
        pattern.exec(
          html
        )
    ) !== null
  ) {
    try {
      const decoded =
        JSON.parse(
          match[1]
        );

      payloads.push(
        decoded
      );
    } catch {
      // Ignore malformed / unrelated payloads.
    }
  }

  return payloads;
}


/*
 * Recursively find objects containing:
 *
 * initialData.news_headlines
 *
 * or:
 *
 * content.news_headlines
 *
 * The latter is used by the LATEST NEWS block.
 */
function collectCricketScotlandNewsBlocks(
  value,
  blocks
) {
  if (
    value === null ||
    value === undefined
  ) {
    return;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    for (
      const item of
      value
    ) {
      collectCricketScotlandNewsBlocks(
        item,
        blocks
      );
    }

    return;
  }

  if (
    typeof value !==
    "object"
  ) {
    return;
  }


  if (
    value.initialData &&
    Array.isArray(
      value.initialData
        .news_headlines
    )
  ) {
    blocks.push(
      value.initialData
    );
  }


  if (
    value.content &&
    Array.isArray(
      value.content
        .news_headlines
    )
  ) {
    blocks.push(
      value.content
    );
  }


  for (
    const child of
    Object.values(
      value
    )
  ) {
    collectCricketScotlandNewsBlocks(
      child,
      blocks
    );
  }
}


function extractCricketScotlandArticles(
  html,
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const allowedSectionTitles =
    new Set([
      "INTERNATIONAL NEWS",
      "DOMESTIC NEWS",
      "GOVERNANCE NEWS",
    ]);

  const resultsById =
    new Map();

  const payloads =
    extractCricketScotlandRscPayloads(
      html
    );

  const blocks =
    [];


  for (
    const payload of
    payloads
  ) {
    const colonIndex =
      payload.indexOf(
        ":"
      );

    if (
      colonIndex ===
      -1
    ) {
      continue;
    }

    const jsonText =
      payload.slice(
        colonIndex + 1
      );

    try {
      const parsed =
        JSON.parse(
          jsonText
        );

      collectCricketScotlandNewsBlocks(
        parsed,
        blocks
      );
    } catch {
      /*
       * Some Next.js payloads contain
       * text fragments rather than JSON.
       *
       * Those are irrelevant here.
       */
    }
  }


  let sectionBlocksFound =
    0;

  let latestBlocksFound =
    0;

  let rawCandidates =
    0;

  let invalidItems =
    0;

  const sectionCounts = {
    latest:
      0,

    international:
      0,

    domestic:
      0,

    governance:
      0,
  };


  for (
    const block of
    blocks
  ) {
    const blockTitle =
      cleanText(
        block?.title
      ).toUpperCase();

    const isCategorySection =
      allowedSectionTitles.has(
        blockTitle
      );

    const isLatestSection =
      blockTitle ===
      "LATEST NEWS";


    if (
      !isCategorySection &&
      !isLatestSection
    ) {
      continue;
    }


    if (
      isLatestSection
    ) {
      latestBlocksFound +=
        1;
    } else {
      sectionBlocksFound +=
        1;
    }


    const headlines =
      Array.isArray(
        block?.news_headlines
      )
        ? block.news_headlines
        : [];


    for (
      const headline of
      headlines
    ) {
      const item =
        headline?.item;

      if (
        !item ||
        typeof item !==
          "object"
      ) {
        invalidItems +=
          1;

        continue;
      }


      const category =
        cleanText(
          item?.category
        ).toUpperCase();


      /*
       * LATEST NEWS is separate from
       * the three category arrays.
       *
       * Only accept latest items if they
       * belong to one of the categories
       * the user wants.
       */
      if (
        isLatestSection
      ) {
        const wantedLatest =
          category.includes(
            "INTERNATIONAL"
          ) ||
          category.includes(
            "DOMESTIC"
          ) ||
          category.includes(
            "GOVERNANCE"
          );

        if (
          !wantedLatest
        ) {
          continue;
        }

        sectionCounts.latest +=
          1;
      }


      if (
        blockTitle ===
        "INTERNATIONAL NEWS"
      ) {
        sectionCounts.international +=
          1;
      }

      if (
        blockTitle ===
        "DOMESTIC NEWS"
      ) {
        sectionCounts.domestic +=
          1;
      }

      if (
        blockTitle ===
        "GOVERNANCE NEWS"
      ) {
        sectionCounts.governance +=
          1;
      }


      rawCandidates +=
        1;


      const id =
        cleanText(
          item?.id
        );

      const title =
        cleanHeadline(
          item?.title ||
          ""
        );

      const articleDate =
        parseCricketScotlandDate(
          item?.publish_date
        );


      if (
        !id ||
        !title ||
        title.length < 5 ||
        !articleDate
      ) {
        invalidItems +=
          1;

        continue;
      }


      /*
       * Inclusive start date.
       */
      if (
        articleDate <
        selectedStart
      ) {
        continue;
      }


      let articleUrl;

      try {
        articleUrl =
          new URL(
            `/Article/${id}`,
            sourceUrl
          ).toString();
      } catch {
        invalidItems +=
          1;

        continue;
      }


      const row =
        createResultRow({
          organizationName:
            "Cricket Scotland",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      /*
       * The same article can appear in
       * more than one section, so dedupe
       * using the Cricket Scotland ID.
       */
      resultsById.set(
        id,
        row
      );
    }
  }


  const results = [
    ...resultsById.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";

  if (
    sectionBlocksFound ===
      0 &&
    latestBlocksFound ===
      0
  ) {
    warning =
      "Cricket Scotland news data was not found in the Next.js page payload.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Cricket Scotland news was detected successfully, but no International, Domestic or Governance articles were on or after the selected date.";
  } else if (
    invalidItems > 0
  ) {
    warning =
      `Returned ${results.length} Cricket Scotland article(s). ` +
      `${invalidItems} item(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Cricket Scotland",

    sourceName:
      "Cricket Scotland",

    scannedCandidates:
      rawCandidates,

    results,

    warning,

    diagnostics: {
      adapter:
        "cricket-scotland-next-rsc",

      rscPayloadsFound:
        payloads.length,

      sectionBlocksFound,

      latestBlocksFound,

      sectionCounts,

      rawCandidates,

      uniqueArticlesReturned:
        results.length,

      invalidItems,
    },
  };
}


async function scrapeCricketScotlandNews(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );

  return extractCricketScotlandArticles(
    html,
    finalUrl,
    sinceDate
  );
}

/* =========================================================
   KNCB ADAPTER
   Input URL can remain:
   https://kncb.nl/nieuws.php

   Internally we scrape KNCB's official English news pages.
========================================================= */

function isKncbNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "kncb.nl" &&
      (
        path ===
          "/nieuws.php" ||
        path ===
          "/en/news" ||
        path ===
          "/en/news.php"
      )
    );
  } catch {
    return false;
  }
}


/*
 * KNCB English dates look like:
 *
 * 27 September 2026
 * 25 September 2026
 *
 * We first use the common parser.
 * The fallback below makes the adapter
 * independent if the common parser ever
 * changes.
 */
function parseKncbEnglishDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }


  const common =
    parseDateText(
      text
    );

  if (common) {
    return common;
  }


  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };


  const match =
    text.match(
      /\b(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\b/i
    );

  if (!match) {
    return null;
  }


  const month =
    months[
      match[2].toLowerCase()
    ];

  if (
    month ===
    undefined
  ) {
    return null;
  }


  return dateFromParts(
    Number(
      match[3]
    ),
    month,
    Number(
      match[1]
    )
  );
}


/*
 * Page 1:
 * https://www.kncb.nl/en/news
 *
 * Page 2:
 * https://www.kncb.nl/en/news.php?page=2
 *
 * etc.
 */
function getKncbEnglishListingUrl(
  pageNumber
) {
  if (
    pageNumber <= 1
  ) {
    return (
      "https://www.kncb.nl/en/news"
    );
  }

  return (
    "https://www.kncb.nl/en/news.php?page=" +
    pageNumber
  );
}


function extractKncbEnglishPage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let articleCardsFound =
    0;

  let invalidCards =
    0;

  let oldestDate =
    null;


  /*
   * KNCB listing cards look like:
   *
   * <div class="col-md-4 mb-5">
   *   <a href="news-...">
   *
   *     <span class="small lgrijs ...">
   *       27 September 2026
   *     </span>
   *
   *     <h3>
   *       Promising Season for ACC Youth
   *     </h3>
   *
   *   </a>
   * </div>
   */
  $(".col-md-4.mb-5").each(
    (_, card) => {
      const root =
        $(card);


      /*
       * Footer columns also use similar
       * Bootstrap classes, so require an
       * anchor containing an h3.
       */
      let articleLink =
        null;


      root
        .find(
          "a[href]"
        )
        .each(
          (_, anchor) => {
            if (
              articleLink
            ) {
              return;
            }

            if (
              $(anchor)
                .find(
                  "h3"
                )
                .length >
              0
            ) {
              articleLink =
                $(anchor);
            }
          }
        );


      if (
        !articleLink
      ) {
        return;
      }


      const title =
        cleanHeadline(
          articleLink
            .find(
              "h3"
            )
            .first()
            .text()
        );


      const href =
        cleanText(
          articleLink.attr(
            "href"
          )
        );


      const rawDate =
        cleanText(
          root
            .find(
              "span.small.lgrijs"
            )
            .first()
            .text()
        );


      const articleDate =
        parseKncbEnglishDate(
          rawDate
        );


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "kncb.nl"
        ) {
          return;
        }


        /*
         * English KNCB stories use:
         *
         * /en/news-story-slug
         */
        const path =
          parsed.pathname
            .toLowerCase();


        if (
          !path.startsWith(
            "/en/news-"
          )
        ) {
          return;
        }


        parsed.hash =
          "";


        articleUrl =
          parsed.toString();
      } catch {
        articleUrl =
          "";
      }


      articleCardsFound +=
        1;


      if (
        !title ||
        title.length <
          5 ||
        !articleUrl ||
        !articleDate
      ) {
        invalidCards +=
          1;

        return;
      }


      if (
        !oldestDate ||
        articleDate <
          oldestDate
      ) {
        oldestDate =
          articleDate;
      }


      /*
       * Selected start date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "KNCB",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


async function scrapeKncbNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  /*
   * KNCB currently has several pages.
   *
   * You normally scrape only a few days
   * back, so this will normally stop
   * after page 1.
   *
   * 10 gives us room if needed later.
   */
  const maxListingPages =
    10;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let totalCards =
    0;

  let invalidCards =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getKncbEnglishListingUrl(
        pageNumber
      );


    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );


    pagesFetched +=
      1;


    const page =
      extractKncbEnglishPage(
        html,
        finalUrl,
        sinceDate
      );


    totalCards +=
      page.articleCardsFound;


    invalidCards +=
      page.invalidCards;


    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );


      if (!key) {
        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * No article cards means we have
     * reached the end of pagination.
     */
    if (
      page.articleCardsFound ===
      0
    ) {
      break;
    }


    /*
     * KNCB pages are newest first.
     *
     * Once the oldest article on this
     * page is older than the selected
     * start date, we do not need older
     * pages.
     */
    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    totalCards ===
    0
  ) {
    warning =
      "No KNCB English news article cards were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "KNCB English articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards >
    0
  ) {
    warning =
      `Returned ${results.length} KNCB article(s). ` +
      `${invalidCards} article card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "KNCB",

    sourceName:
      "KNCB",

    scannedCandidates:
      totalCards,

    results,

    warning,

    diagnostics: {
      adapter:
        "kncb-official-english-listing",

      originalSourceUrl:
        sourceUrl,

      englishListingUrl:
        "https://www.kncb.nl/en/news",

      pagesFetched,

      articleCardsFound:
        totalCards,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   UK ORDINAL DATE HELPER
========================================================= */

function parseUkOrdinalDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }

  /*
   * Examples:
   *
   * Wed 7th October 2026
   * 7th October 2026
   * 2nd October 2026
   *
   * Convert:
   * 7th -> 7
   * 2nd -> 2
   *
   * Then reuse the common date parser.
   */
  const normalized =
    text.replace(
      /\b(\d{1,2})(?:st|nd|rd|th)\b/gi,
      "$1"
    );

  return parseDateText(
    normalized
  );
}

/* =========================================================
   DERBYSHIRE COUNTY CRICKET CLUB ADAPTER
========================================================= */

function isDerbyshireNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "derbyshireccc.com" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


function extractDerbyshireNewsPage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let articleCardsFound =
    0;

  let invalidCards =
    0;

  let oldestDate =
    null;


  /*
   * Derbyshire card:
   *
   * <a
   *   href="https://derbyshireccc.com/2026/10/..."
   *   class="... js-newsfeed-news"
   * >
   *
   *   <p>
   *     Wed 7th October 2026
   *   </p>
   *
   *   <h2>
   *     Article title
   *   </h2>
   *
   * </a>
   */
  $("a.js-newsfeed-news[href]").each(
    (_, card) => {
      articleCardsFound +=
        1;

      const root =
        $(card);

      const href =
        cleanText(
          root.attr(
            "href"
          )
        );


      const title =
        cleanHeadline(
          root
            .find(
              "h2"
            )
            .first()
            .text()
        );


      /*
       * Locate the paragraph containing
       * the publication date.
       */
      let articleDate =
        null;

      const paragraphs =
        root
          .find(
            "p"
          )
          .toArray();

      for (
        const paragraph of
        paragraphs
      ) {
        const text =
          cleanText(
            $(paragraph).text()
          );

        const parsed =
          parseUkOrdinalDate(
            text
          );

        if (
          parsed
        ) {
          articleDate =
            parsed;

          break;
        }
      }


      let articleUrl =
        "";

      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );

        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );

        if (
          host !==
          "derbyshireccc.com"
        ) {
          invalidCards +=
            1;

          return;
        }

        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      if (
        !title ||
        title.length < 5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidCards +=
          1;

        return;
      }


      if (
        !oldestDate ||
        articleDate <
          oldestDate
      ) {
        oldestDate =
          articleDate;
      }


      /*
       * Inclusive selected date.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Derbyshire County Cricket Club",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


function getDerbyshireListingUrl(
  sourceUrl,
  pageNumber
) {
  const url =
    new URL(
      sourceUrl
    );


  if (
    pageNumber <= 1
  ) {
    url.pathname =
      "/news/";

    url.search =
      "";

    return url.toString();
  }


  url.pathname =
    `/news/page/${pageNumber}/`;

  url.search =
    "";

  return url.toString();
}


async function scrapeDerbyshireNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const maxListingPages =
    5;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let totalCards =
    0;

  let invalidCards =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getDerbyshireListingUrl(
        sourceUrl,
        pageNumber
      );


    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );


    pagesFetched +=
      1;


    const page =
      extractDerbyshireNewsPage(
        html,
        finalUrl,
        sinceDate
      );


    totalCards +=
      page.articleCardsFound;


    invalidCards +=
      page.invalidCards;


    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );

      if (!key) {
        continue;
      }

      resultsByUrl.set(
        key,
        row
      );
    }


    if (
      page.articleCardsFound ===
      0
    ) {
      break;
    }


    /*
     * Listing is newest first.
     *
     * Once this page reaches an article
     * before the selected date, later
     * pages are unnecessary.
     */
    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    totalCards ===
    0
  ) {
    warning =
      "No Derbyshire County Cricket Club news cards were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Derbyshire articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards >
    0
  ) {
    warning =
      `Returned ${results.length} Derbyshire article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Derbyshire County Cricket Club",

    sourceName:
      "Derbyshire County Cricket Club",

    scannedCandidates:
      totalCards,

    results,

    warning,

    diagnostics: {
      adapter:
        "derbyshire-listing-html",

      pagesFetched,

      articleCardsFound:
        totalCards,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   DURHAM CRICKET ADAPTER
========================================================= */

function isDurhamCricketNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "durhamcricket.co.uk" &&
      path ===
        "/news-and-media"
    );
  } catch {
    return false;
  }
}


function extractDurhamCricketNewsPage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );

  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );

  const resultsByUrl =
    new Map();

  let articleCardsFound =
    0;

  let invalidCards =
    0;

  let oldestDate =
    null;


  /*
   * Durham uses two versions of the card:
   *
   * Featured:
   *
   * .c__comp__tile__infoTile__featureContent__meta
   * .c__comp__tile__infoTile__featureContent__summary
   *
   * Normal:
   *
   * .c__comp__tile__infoTile__content__date
   * .c__comp__tile__infoTile__content__summary
   *
   * Both have:
   *
   * <a class="tileFillCta" href="...">
   */
  $(
    ".c__comp__listing .c__comp__tile.c__comp__tile__infoTile"
  ).each(
    (_, card) => {
      const root =
        $(card);


      const link =
        root
          .find(
            "a.tileFillCta[href]"
          )
          .first();


      if (
        !link.length
      ) {
        return;
      }


      articleCardsFound +=
        1;


      const href =
        cleanText(
          link.attr(
            "href"
          )
        );


      /*
       * Normal card first,
       * featured-card title second.
       */
      let title =
        cleanHeadline(
          root
            .find(
              ".c__comp__tile__infoTile__content__summary p"
            )
            .first()
            .text()
        );


      if (!title) {
        title =
          cleanHeadline(
            root
              .find(
                ".c__comp__tile__infoTile__featureContent__summary p"
              )
              .first()
              .text()
          );
      }


      /*
       * Normal cards have one explicit
       * date span.
       */
      let articleDate =
        parseUkOrdinalDate(
          root
            .find(
              ".c__comp__tile__infoTile__content__date"
            )
            .first()
            .text()
        );


      /*
       * The featured card has multiple
       * metadata spans:
       *
       * 7th October 2026
       * Feature
       *
       * Therefore test them one by one.
       */
      if (
        !articleDate
      ) {
        const metaSpans =
          root
            .find(
              ".c__comp__tile__infoTile__featureContent__meta span"
            )
            .toArray();


        for (
          const span of
          metaSpans
        ) {
          const parsed =
            parseUkOrdinalDate(
              $(span).text()
            );

          if (
            parsed
          ) {
            articleDate =
              parsed;

            break;
          }
        }
      }


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "durhamcricket.co.uk"
        ) {
          invalidCards +=
            1;

          return;
        }


        const path =
          parsed.pathname
            .toLowerCase();


        /*
         * Only actual news/media posts,
         * not the listing/category pages.
         */
        if (
          !path.startsWith(
            "/news-and-media/"
          ) ||
          path ===
            "/news-and-media/"
        ) {
          invalidCards +=
            1;

          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      if (
        !title ||
        title.length < 5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidCards +=
          1;

        return;
      }


      if (
        !oldestDate ||
        articleDate <
          oldestDate
      ) {
        oldestDate =
          articleDate;
      }


      /*
       * Inclusive start date.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Durham Cricket",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


function getDurhamCricketListingUrl(
  sourceUrl,
  pageNumber
) {
  const url =
    new URL(
      sourceUrl
    );


  if (
    pageNumber <= 1
  ) {
    url.pathname =
      "/news-and-media/";

    url.search =
      "";

    return url.toString();
  }


  url.pathname =
    `/news-and-media/page/${pageNumber}/`;

  url.search =
    "";

  return url.toString();
}


async function scrapeDurhamCricketNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const maxListingPages =
    5;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let totalCards =
    0;

  let invalidCards =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getDurhamCricketListingUrl(
        sourceUrl,
        pageNumber
      );


    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );


    pagesFetched +=
      1;


    const page =
      extractDurhamCricketNewsPage(
        html,
        finalUrl,
        sinceDate
      );


    totalCards +=
      page.articleCardsFound;


    invalidCards +=
      page.invalidCards;


    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );


      if (!key) {
        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    if (
      page.articleCardsFound ===
      0
    ) {
      break;
    }


    /*
     * Durham is newest first.
     */
    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    totalCards ===
    0
  ) {
    warning =
      "No Durham Cricket news cards were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Durham Cricket articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards >
    0
  ) {
    warning =
      `Returned ${results.length} Durham Cricket article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Durham Cricket",

    sourceName:
      "Durham Cricket",

    scannedCandidates:
      totalCards,

    results,

    warning,

    diagnostics: {
      adapter:
        "durham-cricket-listing-html",

      pagesFetched,

      articleCardsFound:
        totalCards,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   GLOUCESTERSHIRE CRICKET ADAPTER
========================================================= */

function isGloucestershireNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "gloscricket.co.uk" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


/*
 * API dates are already:
 *
 * 2026-10-05
 */
function parseGloucestershireApiDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }

  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return null;
  }

  return dateFromParts(
    Number(
      match[1]
    ),
    Number(
      match[2]
    ) - 1,
    Number(
      match[3]
    )
  );
}


/*
 * Gloucestershire public stories use
 * the slug supplied by the API.
 *
 * Example:
 *
 * /news/an-open-letter-from-craig-miles
 */
function createGloucestershireArticleUrl(
  item
) {
  const slug =
    cleanText(
      item?.slug
    );

  if (!slug) {
    return "";
  }

  try {
    return new URL(
      `/news/${slug}`,
      "https://gloscricket.co.uk"
    ).toString();
  } catch {
    return "";
  }
}


async function fetchGloucestershireNewsPage(
  pageNumber,
  pageSize = 50
) {
  const apiUrl =
    "https://api.gloscricket.co.uk/api/frontend/getAllNews" +
    `?page=${pageNumber}` +
    "&category_id=1" +
    `&page_size=${pageSize}`;


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      20000
    );


  try {
    const response =
      await fetch(
        apiUrl,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json, text/plain, */*",

            "User-Agent":
              USER_AGENT,

            Referer:
              "https://gloscricket.co.uk/",

            Origin:
              "https://gloscricket.co.uk",
          },

          cache:
            "no-store",

          redirect:
            "follow",

          signal:
            controller.signal,
        }
      );


    if (
      !response.ok
    ) {
      throw new Error(
        `Gloucestershire Cricket API returned HTTP ${response.status}.`
      );
    }


    const data =
      await response.json();


    if (
      Number(
        data?.status
      ) !== 200 ||
      !Array.isArray(
        data?.data
      )
    ) {
      throw new Error(
        "Gloucestershire Cricket API returned an unexpected response format."
      );
    }


    return {
      apiUrl,

      items:
        data.data,

      currentPage:
        Number(
          data?.current_page
        ) ||
        pageNumber,

      totalPages:
        Number(
          data?.totalPages
        ) ||
        0,

      isNextPage:
        String(
          data?.isNextPage ||
          ""
        ).toUpperCase() ===
        "Y",
    };
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Gloucestershire Cricket API took too long to respond."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}


async function scrapeGloucestershireNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  /*
   * API requests are cheap.
   *
   * 50 stories per page means five pages
   * covers up to 250 recent articles.
   *
   * For your usual 1-3 day searches,
   * page 1 should normally be enough.
   */
  const pageSize =
    50;

  const maxPages =
    5;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let apiItemsReturned =
    0;

  let invalidItems =
    0;

  let activeItems =
    0;

  let lastApiUrl =
    "";


  for (
    let pageNumber = 1;
    pageNumber <=
    maxPages;
    pageNumber += 1
  ) {
    const page =
      await fetchGloucestershireNewsPage(
        pageNumber,
        pageSize
      );


    pagesFetched +=
      1;

    lastApiUrl =
      page.apiUrl;


    apiItemsReturned +=
      page.items.length;


    let newestDateOnPage =
      null;

    let oldestDateOnPage =
      null;


    for (
      const item of
      page.items
    ) {
      /*
       * Ignore anything no longer active.
       */
      const itemStatus =
        cleanText(
          item?.status
        ).toLowerCase();


      if (
        itemStatus &&
        itemStatus !==
          "active"
      ) {
        continue;
      }


      activeItems +=
        1;


      const title =
        cleanHeadline(
          item?.news_title ||
          item?.meta_title ||
          ""
        );


      const articleDate =
        parseGloucestershireApiDate(
          item?.date
        );


      const articleUrl =
        createGloucestershireArticleUrl(
          item
        );


      if (
        !title ||
        title.length <
          5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidItems +=
          1;

        continue;
      }


      if (
        !newestDateOnPage ||
        articleDate >
          newestDateOnPage
      ) {
        newestDateOnPage =
          articleDate;
      }


      if (
        !oldestDateOnPage ||
        articleDate <
          oldestDateOnPage
      ) {
        oldestDateOnPage =
          articleDate;
      }


      /*
       * Selected date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        continue;
      }


      const row =
        createResultRow({
          organizationName:
            "Gloucestershire Cricket",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          sourceUrl
        );


      if (!key) {
        invalidItems +=
          1;

        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * No more API pages.
     */
    if (
      !page.isNextPage ||
      page.items.length ===
        0
    ) {
      break;
    }


    /*
     * The API is broadly ordered by
     * recent submissions, although items
     * inside an individual page are not
     * perfectly date-sorted.
     *
     * Therefore we do NOT stop merely
     * because one old item was found.
     *
     * We only stop once even the newest
     * dated article on the entire page
     * is older than the user's start date.
     */
    if (
      newestDateOnPage &&
      newestDateOnPage <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    apiItemsReturned ===
    0
  ) {
    warning =
      "Gloucestershire Cricket API returned no news items.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Gloucestershire Cricket articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidItems >
    0
  ) {
    warning =
      `Returned ${results.length} Gloucestershire Cricket article(s). ` +
      `${invalidItems} API item(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Gloucestershire Cricket",

    sourceName:
      "Gloucestershire Cricket",

    scannedCandidates:
      activeItems,

    results,

    warning,

    diagnostics: {
      adapter:
        "gloucestershire-official-news-api",

      pagesFetched,

      pageSize,

      apiItemsReturned,

      activeItems,

      invalidItems,

      articlesReturned:
        results.length,

      lastApiUrl,
    },
  };
}

/* =========================================================
   HAMPSHIRE CRICKET / UTILITA BOWL ADAPTER
========================================================= */

function isHampshireCricketNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "utilitabowl.com" &&
      path ===
        "/cricket/news"
    );
  } catch {
    return false;
  }
}


function parseHampshireListingDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }


  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };


  /*
   * Examples:
   *
   * Friday  2 October
   * Thursday 1 October
   * Wednesday 30 September
   */
  const match =
    text.match(
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i
    );


  if (!match) {
    return null;
  }


  const day =
    Number(
      match[1]
    );

  const month =
    months[
      match[2].toLowerCase()
    ];


  const now =
    new Date();


  let year =
    now.getUTCFullYear();


  let candidate =
    dateFromParts(
      year,
      month,
      day
    );


  /*
   * Handles the New Year boundary.
   *
   * Example:
   * If today is January 2027 and a card
   * says "31 December", that article is
   * obviously from December 2026.
   */
  const fortyFiveDays =
    45 *
    24 *
    60 *
    60 *
    1000;


  if (
    candidate.getTime() -
      now.getTime() >
    fortyFiveDays
  ) {
    year -=
      1;

    candidate =
      dateFromParts(
        year,
        month,
        day
      );
  }


  return candidate;
}


function extractHampshireCricketPage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );


  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const resultsByUrl =
    new Map();


  let articleCardsFound =
    0;

  let invalidCards =
    0;

  let oldestDate =
    null;


  /*
   * Hampshire has:
   *
   * 1 featured article:
   * article.post-featured
   *
   * plus normal headline cards:
   * .articles article.post
   */
  $(
    "article.post-featured, .articles article.post"
  ).each(
    (_, article) => {
      const root =
        $(article);


      const headlineLink =
        root
          .find(
            "h2 a[itemprop='name'][href], h3 a[itemprop='name'][href]"
          )
          .first();


      if (
        !headlineLink.length
      ) {
        return;
      }


      articleCardsFound +=
        1;


      const title =
        cleanHeadline(
          headlineLink.text()
        );


      const href =
        cleanText(
          headlineLink.attr(
            "href"
          )
        );


      const articleDate =
        parseHampshireListingDate(
          root
            .find(
              "time"
            )
            .first()
            .text()
        );


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "utilitabowl.com"
        ) {
          invalidCards +=
            1;

          return;
        }


        if (
          !parsed.pathname
            .toLowerCase()
            .startsWith(
              "/cricket/news/"
            )
        ) {
          invalidCards +=
            1;

          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      if (
        !title ||
        title.length <
          5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidCards +=
          1;

        return;
      }


      if (
        !oldestDate ||
        articleDate <
          oldestDate
      ) {
        oldestDate =
          articleDate;
      }


      /*
       * Selected date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Hampshire Cricket",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


function getHampshireCricketListingUrl(
  sourceUrl,
  pageNumber
) {
  const url =
    new URL(
      sourceUrl
    );


  url.pathname =
    "/cricket/news/";


  if (
    pageNumber <=
    1
  ) {
    url.search =
      "";
  } else {
    url.search =
      `?page=${pageNumber}`;
  }


  return url.toString();
}


async function scrapeHampshireCricketNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const maxListingPages =
    5;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let totalCards =
    0;

  let invalidCards =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getHampshireCricketListingUrl(
        sourceUrl,
        pageNumber
      );


    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );


    pagesFetched +=
      1;


    const page =
      extractHampshireCricketPage(
        html,
        finalUrl,
        sinceDate
      );


    totalCards +=
      page.articleCardsFound;


    invalidCards +=
      page.invalidCards;


    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );


      if (!key) {
        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    if (
      page.articleCardsFound ===
      0
    ) {
      break;
    }


    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    totalCards ===
    0
  ) {
    warning =
      "No Hampshire Cricket news cards were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Hampshire Cricket articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards >
    0
  ) {
    warning =
      `Returned ${results.length} Hampshire Cricket article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Hampshire Cricket",

    sourceName:
      "Hampshire Cricket",

    scannedCandidates:
      totalCards,

    results,

    warning,

    diagnostics: {
      adapter:
        "hampshire-cricket-listing-html",

      pagesFetched,

      articleCardsFound:
        totalCards,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}


/* =========================================================
   KENT CRICKET ADAPTER

   IMPORTANT:
   Only articles belonging to:
   Kent Cricket

   team-category-kent-cricket
========================================================= */

function isKentCricketNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );


    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );


    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();


    return (
      host ===
        "kentcricket.co.uk" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


function getKentCricketListingUrl(
  sourceUrl,
  pageNumber
) {
  const url =
    new URL(
      sourceUrl
    );


  /*
   * Use Kent's own built-in team filter.
   *
   * This means the server should already
   * return only "Kent Cricket" stories.
   */
  if (
    pageNumber <=
    1
  ) {
    url.pathname =
      "/news/";
  } else {
    url.pathname =
      `/news/page/${pageNumber}/`;
  }


  url.search =
    "?team-category=kent-cricket";


  return url.toString();
}


function collectKentCricketCandidates(
  html,
  listingUrl
) {
  const $ =
    cheerio.load(
      html
    );


  const candidatesByUrl =
    new Map();


  /*
   * Still enforce the category ourselves,
   * even though the URL already applies
   * Kent's filter.
   *
   * Example:
   *
   * <li class="
   *   post-88897
   *   ...
   *   team-category-kent-cricket
   * ">
   */
  $("ul.news-list > li.team-category-kent-cricket").each(
    (_, item) => {
      const root =
        $(item);


      const headlineLink =
        root
          .find(
            "h3 a[href]"
          )
          .first();


      const title =
        cleanHeadline(
          headlineLink.text()
        );


      const href =
        cleanText(
          headlineLink.attr(
            "href"
          )
        );


      if (
        !title ||
        title.length <
          5 ||
        !href
      ) {
        return;
      }


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "kentcricket.co.uk"
        ) {
          return;
        }


        if (
          !parsed.pathname
            .toLowerCase()
            .startsWith(
              "/news/"
            )
        ) {
          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        return;
      }


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        return;
      }


      candidatesByUrl.set(
        key,
        {
          title,
          url:
            articleUrl,
        }
      );
    }
  );


  return [
    ...candidatesByUrl.values(),
  ];
}


function parseKentCricketDate(
  value
) {
  const text =
    cleanText(
      value
    );


  if (!text) {
    return null;
  }


  /*
   * Metadata:
   *
   * 2026-10-07T...
   */
  const isoMatch =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );


  if (
    isoMatch
  ) {
    return dateFromParts(
      Number(
        isoMatch[1]
      ),
      Number(
        isoMatch[2]
      ) - 1,
      Number(
        isoMatch[3]
      )
    );
  }


  /*
   * Visible article date:
   *
   * Wednesday 7th October 2026
   */
  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };


  const visibleMatch =
    text.match(
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i
    );


  if (
    !visibleMatch
  ) {
    return null;
  }


  return dateFromParts(
    Number(
      visibleMatch[3]
    ),

    months[
      visibleMatch[2]
        .toLowerCase()
    ],

    Number(
      visibleMatch[1]
    )
  );
}


function extractKentCricketArticleDetails(
  html,
  articleUrl,
  fallbackTitle
) {
  const $ =
    cheerio.load(
      html
    );


  /*
   * Try WordPress / Yoast metadata first.
   */
  const metadataValues = [
    $(
      'meta[property="article:published_time"]'
    ).attr(
      "content"
    ),

    $(
      'meta[itemprop="datePublished"]'
    ).attr(
      "content"
    ),

    $(
      'meta[name="date"]'
    ).attr(
      "content"
    ),

    $(
      "time[datetime]"
    )
      .first()
      .attr(
        "datetime"
      ),
  ];


  let articleDate =
    null;


  for (
    const value of
    metadataValues
  ) {
    articleDate =
      parseKentCricketDate(
        value
      );


    if (
      articleDate
    ) {
      break;
    }
  }


  /*
   * Fallback to the visible article date.
   *
   * Kent article pages display:
   *
   * Wednesday 7th October 2026
   */
  if (
    !articleDate
  ) {
    const mainText =
      cleanText(
        $(
          "#main"
        ).text() ||
        $(
          "main"
        ).text() ||
        $(
          "article"
        )
          .first()
          .text()
      );


    articleDate =
      parseKentCricketDate(
        mainText
      );
  }


  const title =
    cleanHeadline(
      fallbackTitle ||
      $(
        "h1"
      )
        .first()
        .text()
    );


  if (
    !articleDate ||
    !title
  ) {
    return null;
  }


  return {
    title,
    url:
      articleUrl,

    date:
      articleDate,
  };
}


async function scrapeKentCricketNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const maxListingPages =
    5;


  const concurrency =
    6;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let candidatesFound =
    0;

  let articlePagesFetched =
    0;

  let invalidArticles =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxListingPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getKentCricketListingUrl(
        sourceUrl,
        pageNumber
      );


    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );


    pagesFetched +=
      1;


    const candidates =
      collectKentCricketCandidates(
        html,
        finalUrl
      );


    candidatesFound +=
      candidates.length;


    if (
      candidates.length ===
      0
    ) {
      break;
    }


    const articleDetails =
      [];


    /*
     * Fetch article pages in small batches
     * instead of all at once.
     */
    for (
      let index = 0;
      index <
      candidates.length;
      index +=
      concurrency
    ) {
      const batch =
        candidates.slice(
          index,
          index +
            concurrency
        );


      const batchResults =
        await Promise.all(
          batch.map(
            async (
              candidate
            ) => {
              try {
                const {
                  html:
                    articleHtml,

                  finalUrl:
                    articleFinalUrl,
                } =
                  await fetchHtmlForArticle(
                    candidate.url
                  );


                articlePagesFetched +=
                  1;


                return extractKentCricketArticleDetails(
                  articleHtml,
                  articleFinalUrl,
                  candidate.title
                );
              } catch {
                invalidArticles +=
                  1;

                return null;
              }
            }
          )
        );


      articleDetails.push(
        ...batchResults.filter(
          Boolean
        )
      );
    }


    let oldestDate =
      null;


    for (
      const article of
      articleDetails
    ) {
      if (
        !oldestDate ||
        article.date <
          oldestDate
      ) {
        oldestDate =
          article.date;
      }


      if (
        article.date <
        selectedStart
      ) {
        continue;
      }


      const row =
        createResultRow({
          organizationName:
            "Kent Cricket",

          date:
            isoDate(
              article.date
            ),

          title:
            article.title,

          url:
            article.url,
        });


      const key =
        articleUrlKey(
          article.url,
          sourceUrl
        );


      if (!key) {
        invalidArticles +=
          1;

        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * Since the filtered archive is
     * newest first, once this page has
     * reached articles older than the
     * selected date we do not need the
     * next page.
     *
     * Only do this if every candidate
     * successfully gave us a date.
     */
    if (
      oldestDate &&
      articleDetails.length ===
        candidates.length &&
      oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    candidatesFound ===
    0
  ) {
    warning =
      "No Kent Cricket category articles were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Kent Cricket category articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidArticles >
    0
  ) {
    warning =
      `Returned ${results.length} Kent Cricket article(s). ` +
      `${invalidArticles} article(s) were skipped because their date could not be confirmed.`;
  }


  return {
    organizationName:
      "Kent Cricket",

    sourceName:
      "Kent Cricket",

    scannedCandidates:
      candidatesFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "kent-cricket-category-article-page-dates",

      category:
        "kent-cricket",

      pagesFetched,

      candidatesFound,

      articlePagesFetched,

      invalidArticles,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   MIDDLESEX CRICKET ADAPTER

   SPECIAL RULE:
   Only return articles marked:
   "1 day ago" / "1d ago"

   No individual article-page requests.
========================================================= */

function isMiddlesexNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "middlesexccc.com" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


/*
 * Middlesex displays relative dates:
 *
 * 1 day ago
 * 2 days ago
 * 7 days ago
 *
 * We ONLY want exactly one day ago.
 */
function isMiddlesexOneDayAgo(
  value
) {
  const text =
    cleanText(
      value
    )
      .toLowerCase()
      .trim();

  return (
    text ===
      "1 day ago" ||
    text ===
      "1 days ago" ||
    text ===
      "1d ago"
  );
}


/*
 * If the article says "1 day ago",
 * its output date is yesterday.
 *
 * Use UTC so local server timezone
 * does not unexpectedly shift the date.
 */
function getMiddlesexYesterdayDate() {
  const now =
    new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1
    )
  );
}


function extractMiddlesexOneDayArticles(
  html,
  listingUrl
) {
  const $ =
    cheerio.load(
      html
    );

  const resultsByUrl =
    new Map();

  const yesterday =
    getMiddlesexYesterdayDate();


  let articleCardsFound =
    0;

  let oneDayAgoCards =
    0;

  let invalidCards =
    0;


  /*
   * Middlesex listing structure:
   *
   * <section class="blog--index">
   *
   *   <a href="/news/2026/10/...">
   *
   *     <span class="time-ago">
   *       1 day ago
   *     </span>
   *
   *     <h3>
   *       Article title
   *     </h3>
   *
   *   </a>
   *
   * </section>
   */
  $(
    "section.blog--index a[href]"
  ).each(
    (_, anchor) => {
      const link =
        $(anchor);


      const href =
        cleanText(
          link.attr(
            "href"
          )
        );


      if (!href) {
        return;
      }


      /*
       * Only real Middlesex article URLs.
       *
       * Example:
       *
       * /news/2026/10/article-slug
       */
      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "middlesexccc.com"
        ) {
          return;
        }


        if (
          !/^\/news\/20\d{2}\/\d{2}\/[^/]+\/?$/i.test(
            parsed.pathname
          )
        ) {
          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        return;
      }


      articleCardsFound +=
        1;


      const timeAgo =
        cleanText(
          link
            .find(
              ".time-ago"
            )
            .first()
            .text()
        );


      /*
       * SPECIAL MIDDLESEX RULE:
       *
       * Ignore everything except
       * articles published one day ago.
       */
      if (
        !isMiddlesexOneDayAgo(
          timeAgo
        )
      ) {
        return;
      }


      oneDayAgoCards +=
        1;


      const title =
        cleanHeadline(
          link
            .find(
              "h3"
            )
            .first()
            .text()
        );


      if (
        !title ||
        title.length <
          5
      ) {
        invalidCards +=
          1;

        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Middlesex Cricket",

          date:
            isoDate(
              yesterday
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    oneDayAgoCards,

    invalidCards,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


async function scrapeMiddlesexNews(
  sourceUrl,
  sinceDate
) {
  /*
   * sinceDate is intentionally NOT used
   * for Middlesex.
   *
   * Middlesex follows the special rule:
   * return only articles labelled
   * "1 day ago".
   */

  const listingUrl =
    "https://www.middlesexccc.com/news";


  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      listingUrl
    );


  const page =
    extractMiddlesexOneDayArticles(
      html,
      finalUrl
    );


  const results =
    page.results.sort(
      (a, b) => {
        const dateCompare =
          b.date.localeCompare(
            a.date
          );

        if (
          dateCompare !==
          0
        ) {
          return dateCompare;
        }

        return a.title.localeCompare(
          b.title
        );
      }
    );


  let warning =
    "";


  if (
    page.articleCardsFound ===
    0
  ) {
    warning =
      "No Middlesex Cricket article cards were detected.";
  } else if (
    page.oneDayAgoCards ===
    0
  ) {
    warning =
      "Middlesex Cricket articles were detected successfully, but none are currently marked as 1 day ago.";
  } else if (
    page.invalidCards >
    0
  ) {
    warning =
      `Returned ${results.length} Middlesex Cricket article(s) marked as 1 day ago. ` +
      `${page.invalidCards} qualifying card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Middlesex Cricket",

    sourceName:
      "Middlesex Cricket",

    scannedCandidates:
      page.articleCardsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "middlesex-one-day-ago-listing",

      rule:
        "Only articles marked 1 day ago",

      articleCardsFound:
        page.articleCardsFound,

      oneDayAgoCards:
        page.oneDayAgoCards,

      invalidCards:
        page.invalidCards,

      articlesReturned:
        results.length,
    },
  };
}


/* =========================================================
   NORTHAMPTONSHIRE CCC ADAPTER

   Input:
   https://nccc.co.uk/news/

   The visible page uses a WPBakery AJAX grid.
   We instead use the site's official
   WordPress REST API.

   This gives:
   - exact publication date
   - title
   - article URL

   No article-page requests are required.
========================================================= */

function isNorthamptonshireNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );


    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );


    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();


    return (
      host ===
        "nccc.co.uk" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


function parseNorthamptonshireApiDate(
  value
) {
  const text =
    cleanText(
      value
    );


  if (!text) {
    return null;
  }


  /*
   * WordPress:
   *
   * 2026-10-05T10:30:00
   */
  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );


  if (!match) {
    return null;
  }


  return dateFromParts(
    Number(
      match[1]
    ),
    Number(
      match[2]
    ) - 1,
    Number(
      match[3]
    )
  );
}


function decodeNorthamptonshireTitle(
  value
) {
  const html =
    String(
      value ||
      ""
    );


  const $ =
    cheerio.load(
      `<div id="northants-title">${html}</div>`
    );


  return cleanHeadline(
    $(
      "#northants-title"
    ).text()
  );
}


async function fetchNorthamptonshirePostsPage(
  pageNumber,
  perPage = 100
) {
  const apiUrl =
    new URL(
      "https://nccc.co.uk/wp-json/wp/v2/posts"
    );


  apiUrl.searchParams.set(
    "page",
    String(
      pageNumber
    )
  );

  apiUrl.searchParams.set(
    "per_page",
    String(
      perPage
    )
  );

  apiUrl.searchParams.set(
    "orderby",
    "date"
  );

  apiUrl.searchParams.set(
    "order",
    "desc"
  );

  apiUrl.searchParams.set(
    "status",
    "publish"
  );

  apiUrl.searchParams.set(
    "_fields",
    "id,date,link,title,status"
  );


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      20000
    );


  try {
    const response =
      await fetch(
        apiUrl.toString(),
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              USER_AGENT,

            Referer:
              "https://nccc.co.uk/news/",
          },

          cache:
            "no-store",

          redirect:
            "follow",

          signal:
            controller.signal,
        }
      );


    /*
     * WordPress returns 400 if we request
     * a page beyond the available range.
     */
    if (
      response.status ===
      400
    ) {
      return {
        apiUrl:
          apiUrl.toString(),

        items:
          [],

        totalPages:
          0,
      };
    }


    if (
      !response.ok
    ) {
      throw new Error(
        `Northamptonshire WordPress API returned HTTP ${response.status}.`
      );
    }


    const data =
      await response.json();


    if (
      !Array.isArray(
        data
      )
    ) {
      throw new Error(
        "Northamptonshire WordPress API returned an unexpected response."
      );
    }


    return {
      apiUrl:
        apiUrl.toString(),

      items:
        data,

      totalPages:
        Number(
          response.headers.get(
            "x-wp-totalpages"
          )
        ) ||
        0,
    };
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Northamptonshire WordPress API took too long to respond."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}


async function scrapeNorthamptonshireNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  /*
   * WordPress allows up to 100 posts
   * per request.
   */
  const perPage =
    100;


  const maxPages =
    5;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let apiItemsReturned =
    0;

  let validNewsItems =
    0;

  let invalidItems =
    0;

  let lastApiUrl =
    "";


  for (
    let pageNumber = 1;
    pageNumber <=
    maxPages;
    pageNumber += 1
  ) {
    const page =
      await fetchNorthamptonshirePostsPage(
        pageNumber,
        perPage
      );


    pagesFetched +=
      1;

    lastApiUrl =
      page.apiUrl;


    if (
      page.items.length ===
      0
    ) {
      break;
    }


    apiItemsReturned +=
      page.items.length;


    let oldestDateOnPage =
      null;


    for (
      const item of
      page.items
    ) {
      const title =
        decodeNorthamptonshireTitle(
          item?.title?.rendered
        );


      const articleDate =
        parseNorthamptonshireApiDate(
          item?.date
        );


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            cleanText(
              item?.link
            )
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        /*
         * Only standard NCCC news posts.
         */
        if (
          host !==
            "nccc.co.uk" ||
          !parsed.pathname
            .toLowerCase()
            .startsWith(
              "/news/"
            ) ||
          parsed.pathname
            .toLowerCase() ===
            "/news/"
        ) {
          continue;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        articleUrl =
          "";
      }


      if (
        !title ||
        title.length <
          5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidItems +=
          1;

        continue;
      }


      validNewsItems +=
        1;


      if (
        !oldestDateOnPage ||
        articleDate <
          oldestDateOnPage
      ) {
        oldestDateOnPage =
          articleDate;
      }


      /*
       * Selected start date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        continue;
      }


      const row =
        createResultRow({
          organizationName:
            "Northamptonshire CCC",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          sourceUrl
        );


      if (!key) {
        invalidItems +=
          1;

        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * Posts are ordered newest first.
     *
     * Once page 1/2/etc has already
     * reached before the selected date,
     * older pages are unnecessary.
     */
    if (
      oldestDateOnPage &&
      oldestDateOnPage <
        selectedStart
    ) {
      break;
    }


    if (
      page.totalPages &&
      pageNumber >=
        page.totalPages
    ) {
      break;
    }


    if (
      page.items.length <
        perPage
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    apiItemsReturned ===
    0
  ) {
    warning =
      "Northamptonshire WordPress API returned no news posts.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Northamptonshire news posts were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidItems >
    0
  ) {
    warning =
      `Returned ${results.length} Northamptonshire article(s). ` +
      `${invalidItems} WordPress item(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Northamptonshire CCC",

    sourceName:
      "Northamptonshire CCC",

    scannedCandidates:
      validNewsItems,

    results,

    warning,

    diagnostics: {
      adapter:
        "northamptonshire-wordpress-rest",

      pagesFetched,

      perPage,

      apiItemsReturned,

      validNewsItems,

      invalidItems,

      articlesReturned:
        results.length,

      lastApiUrl,
    },
  };
}

/* =========================================================
   NOTTINGHAMSHIRE / TRENT BRIDGE ADAPTER

   Input:
   https://www.trentbridge.co.uk/news/index.html

   Listing provides:
   - exact date
   - title
   - article URL

   Video cards are excluded.
========================================================= */

function isNottinghamshireNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "trentbridge.co.uk" &&
      path ===
        "/news/index.html"
    );
  } catch {
    return false;
  }
}


function parseNottinghamshireDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }


  /*
   * Examples:
   *
   * 7/Oct/26
   * 30/Sep/26
   */
  const match =
    text.match(
      /^(\d{1,2})\/([A-Za-z]{3})\/(\d{2})$/
    );


  if (!match) {
    return null;
  }


  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };


  const month =
    months[
      match[2]
        .toLowerCase()
    ];


  if (
    month ===
    undefined
  ) {
    return null;
  }


  const year =
    2000 +
    Number(
      match[3]
    );


  return dateFromParts(
    year,
    month,
    Number(
      match[1]
    )
  );
}


function extractNottinghamshireArticles(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );


  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const resultsByUrl =
    new Map();


  let newsCardsFound =
    0;

  let videoCardsSkipped =
    0;

  let invalidCards =
    0;


  $(
    ".template-news .news-item"
  ).each(
    (_, card) => {
      const root =
        $(card);


      /*
       * Trent Bridge marks video-only
       * entries with:
       *
       * class="video news-item"
       *
       * We only want articles.
       */
      if (
        root.hasClass(
          "video"
        )
      ) {
        videoCardsSkipped +=
          1;

        return;
      }


      newsCardsFound +=
        1;


      const rawDate =
        cleanText(
          root
            .find(
              "h4.date"
            )
            .first()
            .text()
        );


      const articleDate =
        parseNottinghamshireDate(
          rawDate
        );


      const title =
        cleanHeadline(
          root
            .find(
              "h4.title"
            )
            .first()
            .text()
        );


      const href =
        cleanText(
          root
            .find(
              ".caption a[href]"
            )
            .first()
            .attr(
              "href"
            )
        );


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "trentbridge.co.uk"
        ) {
          invalidCards +=
            1;

          return;
        }


        if (
          !parsed.pathname
            .toLowerCase()
            .startsWith(
              "/news/"
            )
        ) {
          invalidCards +=
            1;

          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      if (
        !articleDate ||
        !title ||
        title.length < 5 ||
        !articleUrl
      ) {
        invalidCards +=
          1;

        return;
      }


      /*
       * Inclusive start date.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Nottinghamshire County Cricket Club",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    newsCardsFound ===
    0
  ) {
    warning =
      "No Nottinghamshire news article cards were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Nottinghamshire articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards > 0
  ) {
    warning =
      `Returned ${results.length} Nottinghamshire article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Nottinghamshire County Cricket Club",

    sourceName:
      "Nottinghamshire County Cricket Club",

    scannedCandidates:
      newsCardsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "nottinghamshire-listing-html",

      newsCardsFound,

      videoCardsSkipped,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}


async function scrapeNottinghamshireNews(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );


  return extractNottinghamshireArticles(
    html,
    finalUrl,
    sinceDate
  );
}

/* =========================================================
   SOMERSET COUNTY CRICKET CLUB ADAPTER

   Input:
   https://somersetcountycc.co.uk/news/

   SPECIAL RULE:
   Return only:
   - Club News
   - First XI

   No individual article-page requests.
========================================================= */

function isSomersetNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );


    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );


    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();


    return (
      host ===
        "somersetcountycc.co.uk" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


function parseSomersetDate(
  value
) {
  const text =
    cleanText(
      value
    );


  if (!text) {
    return null;
  }


  /*
   * Examples:
   *
   * 07 Oct 2026
   * 30 Sep 2026
   */
  const match =
    text.match(
      /^(\d{1,2})\s+([A-Za-z]{3})\s+(20\d{2})$/
    );


  if (!match) {
    return null;
  }


  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };


  const month =
    months[
      match[2]
        .toLowerCase()
    ];


  if (
    month ===
    undefined
  ) {
    return null;
  }


  return dateFromParts(
    Number(
      match[3]
    ),
    month,
    Number(
      match[1]
    )
  );
}


function extractSomersetNews(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );


  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const allowedCategories =
    new Set([
      "club news",
      "first xi",
    ]);


  const resultsByUrl =
    new Map();


  let totalCards =
    0;

  let qualifyingCards =
    0;

  let clubNewsCards =
    0;

  let firstXiCards =
    0;

  let otherCategoriesSkipped =
    0;

  let invalidCards =
    0;


  $(
    "#printdatas .blog-new"
  ).each(
    (_, card) => {
      totalCards +=
        1;


      const root =
        $(card);


      const link =
        root
          .find(
            "a[href]"
          )
          .first();


      const href =
        cleanText(
          link.attr(
            "href"
          )
        );


      const category =
        cleanText(
          root
            .find(
              ".playing-now span"
            )
            .first()
            .text()
        );


      const normalizedCategory =
        category
          .toLowerCase()
          .trim();


      /*
       * SOMERSET RULE:
       *
       * Only:
       * - Club News
       * - First XI
       */
      if (
        !allowedCategories.has(
          normalizedCategory
        )
      ) {
        otherCategoriesSkipped +=
          1;

        return;
      }


      qualifyingCards +=
        1;


      if (
        normalizedCategory ===
        "club news"
      ) {
        clubNewsCards +=
          1;
      }


      if (
        normalizedCategory ===
        "first xi"
      ) {
        firstXiCards +=
          1;
      }


      const title =
        cleanHeadline(
          root
            .find(
              "h3"
            )
            .first()
            .text()
        );


      /*
       * Find the direct publication date:
       *
       * <p>07 Oct 2026</p>
       */
      let rawDate =
        "";


      link
        .children(
          "p"
        )
        .each(
          (_, paragraph) => {
            if (
              rawDate
            ) {
              return;
            }


            const text =
              cleanText(
                $(paragraph)
                  .text()
              );


            if (
              /^\d{1,2}\s+[A-Za-z]{3}\s+20\d{2}$/.test(
                text
              )
            ) {
              rawDate =
                text;
            }
          }
        );


      const articleDate =
        parseSomersetDate(
          rawDate
        );


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "somersetcountycc.co.uk"
        ) {
          invalidCards +=
            1;

          return;
        }


        const path =
          parsed.pathname
            .toLowerCase();


        /*
         * Extra safety:
         *
         * Only Somerset Club News
         * and First XI URLs.
         */
        const validPath =
          path.startsWith(
            "/news/club-news/"
          ) ||
          path.startsWith(
            "/news/first-xi/"
          );


        if (
          !validPath
        ) {
          invalidCards +=
            1;

          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      if (
        !title ||
        title.length <
          5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidCards +=
          1;

        return;
      }


      /*
       * Selected start date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Somerset County Cricket Club",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    totalCards ===
    0
  ) {
    warning =
      "No Somerset news cards were detected.";
  } else if (
    qualifyingCards ===
    0
  ) {
    warning =
      "Somerset news was detected, but no Club News or First XI articles were found.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Somerset Club News and First XI articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards >
    0
  ) {
    warning =
      `Returned ${results.length} Somerset article(s). ` +
      `${invalidCards} qualifying card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Somerset County Cricket Club",

    sourceName:
      "Somerset County Cricket Club",

    scannedCandidates:
      qualifyingCards,

    results,

    warning,

    diagnostics: {
      adapter:
        "somerset-club-news-first-xi-listing-html",

      categories: [
        "Club News",
        "First XI",
      ],

      totalCards,

      qualifyingCards,

      clubNewsCards,

      firstXiCards,

      otherCategoriesSkipped,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}


async function scrapeSomersetNews(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );


  return extractSomersetNews(
    html,
    finalUrl,
    sinceDate
  );
}

/* =========================================================
   SUSSEX CRICKET ADAPTER

   Input:
   https://sussexcricket.co.uk/news

   Listing already provides:
   - exact publication date
   - real article headline
   - article URL

   IMPORTANT:
   .news__article__title = category
   .news__article__text  = actual headline
========================================================= */

function isSussexCricketNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "sussexcricket.co.uk" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


/*
 * Sussex gives:
 *
 * 2026-10-06T13:43:01+01:00
 */
function parseSussexCricketDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }


  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );


  if (!match) {
    return null;
  }


  return dateFromParts(
    Number(
      match[1]
    ),
    Number(
      match[2]
    ) - 1,
    Number(
      match[3]
    )
  );
}


/*
 * Drupal pagination:
 *
 * First page:
 * /news
 *
 * Second page:
 * /news?page=1
 *
 * Third page:
 * /news?page=2
 *
 * etc.
 */
function getSussexCricketListingUrl(
  sourceUrl,
  pageIndex
) {
  const url =
    new URL(
      sourceUrl
    );


  url.pathname =
    "/news";


  if (
    pageIndex <=
    0
  ) {
    url.search =
      "";
  } else {
    url.search =
      `?page=${pageIndex}`;
  }


  return url.toString();
}


function extractSussexCricketPage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );


  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const resultsByUrl =
    new Map();


  let articleCardsFound =
    0;

  let invalidCards =
    0;

  let oldestDate =
    null;


  /*
   * Only parse the normal news grid.
   *
   * This excludes the separate featured
   * article block above the grid.
   */
  $(
    "section.news.landing .news__article"
  ).each(
    (_, card) => {
      const root =
        $(card);


      const link =
        root
          .find(
            "a[href]"
          )
          .first();


      if (
        !link.length
      ) {
        return;
      }


      articleCardsFound +=
        1;


      const href =
        cleanText(
          link.attr(
            "href"
          )
        );


      /*
       * IMPORTANT:
       *
       * This is the CATEGORY:
       *
       * .news__article__title
       *
       * Do NOT use that as headline.
       *
       * The actual headline is:
       *
       * .news__article__text
       */
      const title =
        cleanHeadline(
          root
            .find(
              ".news__article__text"
            )
            .first()
            .text()
        );


      const rawDate =
        cleanText(
          root
            .find(
              "time[datetime]"
            )
            .first()
            .attr(
              "datetime"
            )
        );


      const articleDate =
        parseSussexCricketDate(
          rawDate
        );


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "sussexcricket.co.uk"
        ) {
          invalidCards +=
            1;

          return;
        }


        if (
          !parsed.pathname
            .toLowerCase()
            .startsWith(
              "/news/"
            )
        ) {
          invalidCards +=
            1;

          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      if (
        !title ||
        title.length <
          5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidCards +=
          1;

        return;
      }


      if (
        !oldestDate ||
        articleDate <
          oldestDate
      ) {
        oldestDate =
          articleDate;
      }


      /*
       * Selected start date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Sussex Cricket",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


async function scrapeSussexCricketNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  /*
   * Normally page 1 will be enough
   * for your 1-3 day searches.
   */
  const maxPages =
    5;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let totalCards =
    0;

  let invalidCards =
    0;


  for (
    let pageIndex = 0;
    pageIndex <
    maxPages;
    pageIndex += 1
  ) {
    const pageUrl =
      getSussexCricketListingUrl(
        sourceUrl,
        pageIndex
      );


    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );


    pagesFetched +=
      1;


    const page =
      extractSussexCricketPage(
        html,
        finalUrl,
        sinceDate
      );


    totalCards +=
      page.articleCardsFound;


    invalidCards +=
      page.invalidCards;


    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );


      if (!key) {
        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * No cards means pagination ended.
     */
    if (
      page.articleCardsFound ===
      0
    ) {
      break;
    }


    /*
     * Sussex listing is newest first.
     *
     * Once this page reaches articles
     * before the selected start date,
     * later pages are unnecessary.
     */
    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    totalCards ===
    0
  ) {
    warning =
      "No Sussex Cricket news article cards were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Sussex Cricket articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards >
    0
  ) {
    warning =
      `Returned ${results.length} Sussex Cricket article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Sussex Cricket",

    sourceName:
      "Sussex Cricket",

    scannedCandidates:
      totalCards,

    results,

    warning,

    diagnostics: {
      adapter:
        "sussex-cricket-listing-html",

      pagesFetched,

      articleCardsFound:
        totalCards,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   WARWICKSHIRE COUNTY CRICKET CLUB ADAPTER

   Input:
   https://www.edgbaston.com/warwickshire-ccc/news

   The page embeds structured article data containing:
   - name
   - slug
   - mediaType
   - publiclyListed
   - publishDateTime

   No individual article-page requests are required.
========================================================= */

function isWarwickshireNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "edgbaston.com" &&
      path ===
        "/warwickshire-ccc/news"
    );
  } catch {
    return false;
  }
}


/*
 * Example:
 *
 * 2026-10-06T10:20+01:00
 */
function parseWarwickshireDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }


  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );


  if (!match) {
    return null;
  }


  return dateFromParts(
    Number(
      match[1]
    ),
    Number(
      match[2]
    ) - 1,
    Number(
      match[3]
    )
  );
}


/*
 * Svelte serialises article strings as
 * JavaScript/JSON-compatible quoted strings.
 *
 * Example:
 *
 * e.name = "Article title";
 *
 * JSON.parse safely converts things such as
 * escaped quotes back into normal text.
 */
function decodeWarwickshireJsString(
  value
) {
  if (!value) {
    return "";
  }

  try {
    return cleanText(
      JSON.parse(
        value
      )
    );
  } catch {
    /*
     * Very defensive fallback.
     */
    return cleanText(
      String(value)
        .replace(
          /^"/,
          ""
        )
        .replace(
          /"$/,
          ""
        )
    );
  }
}


function extractWarwickshireArticles(
  html,
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const resultsByUrl =
    new Map();


  let structuredRecordsFound =
    0;

  let articleRecordsFound =
    0;

  let nonArticleRecordsSkipped =
    0;

  let privateRecordsSkipped =
    0;

  let invalidRecords =
    0;


  /*
   * Warwickshire's Svelte payload contains
   * records such as:
   *
   * e.name = "Barnard joins...";
   * e.slug = "barnard-joins-...";
   * e.mediaType = "Article";
   * e.publiclyListed = true;
   * e.description = "...";
   * e.publishDateTime =
   *   "2026-10-06T10:20+01:00";
   *
   * We extract those records directly.
   */
  const articlePattern =
    /([A-Za-z_$][\w$]*)\.name\s*=\s*("(?:\\.|[^"\\])*");\s*\1\.slug\s*=\s*("(?:\\.|[^"\\])*");\s*\1\.mediaType\s*=\s*("(?:\\.|[^"\\])*");\s*\1\.publiclyListed\s*=\s*(true|false);[\s\S]*?\1\.publishDateTime\s*=\s*("(?:\\.|[^"\\])*")/g;


  let match;


  while (
    (
      match =
        articlePattern.exec(
          html
        )
    ) !== null
  ) {
    structuredRecordsFound +=
      1;


    const title =
      cleanHeadline(
        decodeWarwickshireJsString(
          match[2]
        )
      );


    const slug =
      decodeWarwickshireJsString(
        match[3]
      );


    const mediaType =
      decodeWarwickshireJsString(
        match[4]
      );


    const publiclyListed =
      match[5] ===
      "true";


    const publishDateTime =
      decodeWarwickshireJsString(
        match[6]
      );


    /*
     * News page may contain different
     * media types.
     *
     * We only want proper articles.
     */
    if (
      mediaType
        .toLowerCase() !==
      "article"
    ) {
      nonArticleRecordsSkipped +=
        1;

      continue;
    }


    if (
      !publiclyListed
    ) {
      privateRecordsSkipped +=
        1;

      continue;
    }


    articleRecordsFound +=
      1;


    const articleDate =
      parseWarwickshireDate(
        publishDateTime
      );


    if (
      !title ||
      title.length <
        5 ||
      !slug ||
      !articleDate
    ) {
      invalidRecords +=
        1;

      continue;
    }


    /*
     * Selected start date is inclusive.
     */
    if (
      articleDate <
      selectedStart
    ) {
      continue;
    }


    let articleUrl =
      "";


    try {
      articleUrl =
        new URL(
          `/warwickshire-ccc/media-article/${slug}`,
          sourceUrl
        ).toString();
    } catch {
      invalidRecords +=
        1;

      continue;
    }


    const row =
      createResultRow({
        organizationName:
          "Warwickshire County Cricket Club",

        date:
          isoDate(
            articleDate
          ),

        title,

        url:
          articleUrl,
      });


    const key =
      articleUrlKey(
        articleUrl,
        sourceUrl
      );


    if (!key) {
      invalidRecords +=
        1;

      continue;
    }


    resultsByUrl.set(
      key,
      row
    );
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    structuredRecordsFound ===
    0
  ) {
    warning =
      "No Warwickshire structured news records were detected in the page.";
  } else if (
    articleRecordsFound ===
    0
  ) {
    warning =
      "Warwickshire data was detected, but no publicly listed articles were found.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Warwickshire articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidRecords >
    0
  ) {
    warning =
      `Returned ${results.length} Warwickshire article(s). ` +
      `${invalidRecords} article record(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Warwickshire County Cricket Club",

    sourceName:
      "Warwickshire County Cricket Club",

    scannedCandidates:
      articleRecordsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "warwickshire-svelte-structured-data",

      structuredRecordsFound,

      articleRecordsFound,

      nonArticleRecordsSkipped,

      privateRecordsSkipped,

      invalidRecords,

      articlesReturned:
        results.length,
    },
  };
}


async function scrapeWarwickshireNews(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );


  return extractWarwickshireArticles(
    html,
    finalUrl,
    sinceDate
  );
}

/* =========================================================
   YORKSHIRE COUNTY CRICKET CLUB ADAPTER

   Input:
   https://yorkshireccc.com/news/

   Listing provides:
   - exact publication date
   - headline
   - article URL
   - category

   All news categories are included.

   No individual article-page requests.
========================================================= */

function isYorkshireNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "yorkshireccc.com" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


/*
 * Yorkshire listing dates:
 *
 * 7 October 26
 * 3 October 26
 * 30 September 26
 */
function parseYorkshireDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }


  const months = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };


  const match =
    text.match(
      /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{2}|\d{4})$/i
    );


  if (!match) {
    return null;
  }


  const day =
    Number(
      match[1]
    );


  const month =
    months[
      match[2]
        .toLowerCase()
    ];


  let year =
    Number(
      match[3]
    );


  /*
   * Yorkshire currently uses:
   *
   * 7 October 26
   *
   * Convert 26 -> 2026.
   */
  if (
    year < 100
  ) {
    year +=
      2000;
  }


  return dateFromParts(
    year,
    month,
    day
  );
}


/*
 * Pagination:
 *
 * page 1:
 * /news/
 *
 * page 2:
 * /news/page/2/
 *
 * page 3:
 * /news/page/3/
 */
function getYorkshireListingUrl(
  sourceUrl,
  pageNumber
) {
  const url =
    new URL(
      sourceUrl
    );


  url.search =
    "";


  if (
    pageNumber <=
    1
  ) {
    url.pathname =
      "/news/";
  } else {
    url.pathname =
      `/news/page/${pageNumber}/`;
  }


  return url.toString();
}


function extractYorkshireNewsPage(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );


  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const resultsByUrl =
    new Map();


  let articleCardsFound =
    0;

  let invalidCards =
    0;

  let oldestDate =
    null;


  /*
   * Only target the actual news cards.
   *
   * This avoids:
   * - adverts
   * - navigation
   * - newsletter content
   */
  $(
    ".news-page .cards__grid > .card"
  ).each(
    (_, card) => {
      const root =
        $(card);


      articleCardsFound +=
        1;


      const link =
        root
          .find(
            "a.full-link[href]"
          )
          .first();


      const href =
        cleanText(
          link.attr(
            "href"
          )
        );


      const title =
        cleanHeadline(
          link
            .find(
              "h2.card__title"
            )
            .first()
            .text()
        );


      const rawDate =
        cleanText(
          root
            .find(
              ".post-meta__date.card__date"
            )
            .first()
            .text()
        );


      const articleDate =
        parseYorkshireDate(
          rawDate
        );


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "yorkshireccc.com"
        ) {
          invalidCards +=
            1;

          return;
        }


        /*
         * Real Yorkshire news articles:
         *
         * /news/article-slug/
         */
        if (
          !parsed.pathname
            .toLowerCase()
            .startsWith(
              "/news/"
            )
        ) {
          invalidCards +=
            1;

          return;
        }


        /*
         * Don't accidentally treat
         * pagination/category URLs
         * as articles.
         */
        const articlePath =
          parsed.pathname
            .replace(
              /\/+$/,
              ""
            )
            .toLowerCase();


        if (
          articlePath ===
            "/news" ||
          articlePath.startsWith(
            "/news/page/"
          ) ||
          articlePath.startsWith(
            "/news/category/"
          )
        ) {
          invalidCards +=
            1;

          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      if (
        !title ||
        title.length <
          5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidCards +=
          1;

        return;
      }


      if (
        !oldestDate ||
        articleDate <
          oldestDate
      ) {
        oldestDate =
          articleDate;
      }


      /*
       * Selected start date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Yorkshire County Cricket Club",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  return {
    articleCardsFound,

    invalidCards,

    oldestDate,

    results: [
      ...resultsByUrl.values(),
    ],
  };
}


async function scrapeYorkshireNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  /*
   * More than enough for your normal
   * 1-3 day searches.
   */
  const maxPages =
    5;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let articleCardsFound =
    0;

  let invalidCards =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxPages;
    pageNumber += 1
  ) {
    const pageUrl =
      getYorkshireListingUrl(
        sourceUrl,
        pageNumber
      );


    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        pageUrl
      );


    pagesFetched +=
      1;


    const page =
      extractYorkshireNewsPage(
        html,
        finalUrl,
        sinceDate
      );


    articleCardsFound +=
      page.articleCardsFound;


    invalidCards +=
      page.invalidCards;


    for (
      const row of
      page.results
    ) {
      const key =
        articleUrlKey(
          row.url,
          finalUrl
        );


      if (!key) {
        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * No cards means we've reached
     * the end of pagination.
     */
    if (
      page.articleCardsFound ===
      0
    ) {
      break;
    }


    /*
     * Yorkshire is newest first.
     *
     * Once the oldest article on this
     * page is before our selected date,
     * later pages are unnecessary.
     */
    if (
      page.oldestDate &&
      page.oldestDate <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    articleCardsFound ===
    0
  ) {
    warning =
      "No Yorkshire Cricket news cards were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Yorkshire Cricket articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards >
    0
  ) {
    warning =
      `Returned ${results.length} Yorkshire article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Yorkshire County Cricket Club",

    sourceName:
      "Yorkshire County Cricket Club",

    scannedCandidates:
      articleCardsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "yorkshire-listing-html",

      pagesFetched,

      articleCardsFound,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   GLAMORGAN CRICKET ADAPTER

   Input:
   https://glamorgancricket.com/news

   Official API:
   https://api-prod.glamorgancricket.com/web/all-news

   API gives:
   - exact publication date
   - title
   - slug
   - pagination

   No article-page requests required.
========================================================= */

function isGlamorganNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "glamorgancricket.com" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


/*
 * Example:
 *
 * 2026-10-06T12:58:28.000Z
 */
function parseGlamorganApiDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }


  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );


  if (!match) {
    return null;
  }


  return dateFromParts(
    Number(
      match[1]
    ),
    Number(
      match[2]
    ) - 1,
    Number(
      match[3]
    )
  );
}


function createGlamorganArticleUrl(
  slug
) {
  const cleanSlug =
    cleanText(
      slug
    );

  if (!cleanSlug) {
    return "";
  }


  try {
    return new URL(
      `/news/${cleanSlug}`,
      "https://glamorgancricket.com"
    ).toString();
  } catch {
    return "";
  }
}


async function fetchGlamorganNewsPage(
  pageNumber
) {
  const apiUrl =
    new URL(
      "https://api-prod.glamorgancricket.com/web/all-news"
    );


  /*
   * API response contains:
   *
   * page
   * totalPages
   * limit
   *
   * so request the required page.
   */
  if (
    pageNumber > 1
  ) {
    apiUrl.searchParams.set(
      "page",
      String(
        pageNumber
      )
    );
  }


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      20000
    );


  try {
    const response =
      await fetch(
        apiUrl.toString(),
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json, text/plain, */*",

            "User-Agent":
              USER_AGENT,

            Referer:
              "https://glamorgancricket.com/news",
          },

          cache:
            "no-store",

          redirect:
            "follow",

          signal:
            controller.signal,
        }
      );


    if (
      !response.ok
    ) {
      throw new Error(
        `Glamorgan API returned HTTP ${response.status}.`
      );
    }


    const json =
      await response.json();


    if (
      json?.status !==
        true ||
      !json?.data ||
      !Array.isArray(
        json.data.blocks
      )
    ) {
      throw new Error(
        "Glamorgan API returned an unexpected response format."
      );
    }


    /*
     * Find:
     *
     * {
     *   block_type: "news",
     *   blockData: {
     *     data: [...]
     *   }
     * }
     */
    const newsBlock =
      json.data.blocks.find(
        (
          block
        ) =>
          block?.block_type ===
          "news" &&
          Array.isArray(
            block?.blockData?.data
          )
      );


    if (
      !newsBlock
    ) {
      throw new Error(
        "Glamorgan API response did not contain a news block."
      );
    }


    const blockData =
      newsBlock.blockData;


    return {
      apiUrl:
        apiUrl.toString(),

      items:
        blockData.data,

      page:
        Number(
          blockData.page
        ) ||
        pageNumber,

      totalPages:
        Number(
          blockData.totalPages
        ) ||
        0,

      totalDocs:
        Number(
          blockData.totalDocs
        ) ||
        0,

      limit:
        Number(
          blockData.limit
        ) ||
        blockData.data.length,
    };
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Glamorgan API took too long to respond."
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}


async function scrapeGlamorganNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  /*
   * Usually page 1 will already cover
   * your normal 1-3 day search.
   */
  const maxPages =
    5;


  const resultsByUrl =
    new Map();


  let pagesFetched =
    0;

  let apiItemsReturned =
    0;

  let invalidItems =
    0;

  let lastApiUrl =
    "";

  let totalDocs =
    0;

  let totalPages =
    0;


  for (
    let pageNumber = 1;
    pageNumber <=
    maxPages;
    pageNumber += 1
  ) {
    const page =
      await fetchGlamorganNewsPage(
        pageNumber
      );


    pagesFetched +=
      1;

    lastApiUrl =
      page.apiUrl;

    totalDocs =
      page.totalDocs;

    totalPages =
      page.totalPages;


    /*
     * Safety check:
     *
     * If the API ever stops respecting
     * the page parameter, don't keep
     * fetching page 1 repeatedly.
     */
    if (
      pageNumber > 1 &&
      page.page !==
        pageNumber
    ) {
      break;
    }


    apiItemsReturned +=
      page.items.length;


    let oldestDateOnPage =
      null;


    for (
      const item of
      page.items
    ) {
      const title =
        cleanHeadline(
          item?.title ||
          ""
        );


      const articleDate =
        parseGlamorganApiDate(
          item?.published_at
        );


      const articleUrl =
        createGlamorganArticleUrl(
          item?.slug
        );


      if (
        !title ||
        title.length <
          5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidItems +=
          1;

        continue;
      }


      if (
        !oldestDateOnPage ||
        articleDate <
          oldestDateOnPage
      ) {
        oldestDateOnPage =
          articleDate;
      }


      /*
       * Selected start date is inclusive.
       */
      if (
        articleDate <
        selectedStart
      ) {
        continue;
      }


      const row =
        createResultRow({
          organizationName:
            "Glamorgan Cricket",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          sourceUrl
        );


      if (!key) {
        invalidItems +=
          1;

        continue;
      }


      resultsByUrl.set(
        key,
        row
      );
    }


    /*
     * No more pages.
     */
    if (
      page.items.length ===
      0
    ) {
      break;
    }


    if (
      page.totalPages &&
      pageNumber >=
        page.totalPages
    ) {
      break;
    }


    /*
     * API is newest first.
     *
     * Once the oldest story on the page
     * is older than the selected date,
     * later pages are unnecessary.
     */
    if (
      oldestDateOnPage &&
      oldestDateOnPage <
        selectedStart
    ) {
      break;
    }
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    apiItemsReturned ===
    0
  ) {
    warning =
      "Glamorgan API returned no news articles.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Glamorgan articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidItems >
    0
  ) {
    warning =
      `Returned ${results.length} Glamorgan article(s). ` +
      `${invalidItems} API item(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Glamorgan Cricket",

    sourceName:
      "Glamorgan Cricket",

    scannedCandidates:
      apiItemsReturned,

    results,

    warning,

    diagnostics: {
      adapter:
        "glamorgan-official-news-api",

      pagesFetched,

      apiItemsReturned,

      invalidItems,

      totalDocs,

      totalPages,

      articlesReturned:
        results.length,

      lastApiUrl,
    },
  };
}

/* =========================================================
   BCCI INTERNATIONAL MEN'S NEWS ADAPTER

   User-facing input can remain:

   https://www.bcci.tv/news?platform=international&type=men

   The current BCCI site uses:
   tags=international,men

   Recent cards sometimes show:
   1d ago
   2d ago
   6h ago

   For those cards only, we open the article page
   to confirm the exact publication date.
========================================================= */

function isBcciNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "bcci.tv" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


/*
 * Always use BCCI's CURRENT filter system,
 * regardless of the old query parameters
 * in the source URL.
 */
function getBcciInternationalMenNewsUrl() {
  const url =
    new URL(
      "https://www.bcci.tv/news"
    );

  url.searchParams.set(
    "tags",
    "international,men"
  );

  return url.toString();
}


/*
 * Exact BCCI dates look like:
 *
 * Sat 26 Sep 2026, 12:24 pm
 * Wed 23 Sep 2026, 5:00 am
 *
 * We only need the calendar date.
 */
function parseBcciExactDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }


  /*
   * ISO metadata fallback:
   *
   * 2026-10-07T...
   */
  const isoMatch =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );


  if (
    isoMatch
  ) {
    return dateFromParts(
      Number(
        isoMatch[1]
      ),

      Number(
        isoMatch[2]
      ) - 1,

      Number(
        isoMatch[3]
      )
    );
  }


  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };


  /*
   * Matches both:
   *
   * Sat 26 Sep 2026, 12:24 pm
   *
   * and:
   *
   * 26 Sep 2026
   */
  const match =
    text.match(
      /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})\b/i
    );


  if (!match) {
    return null;
  }


  const month =
    months[
      match[2]
        .toLowerCase()
    ];


  if (
    month ===
    undefined
  ) {
    return null;
  }


  return dateFromParts(
    Number(
      match[3]
    ),

    month,

    Number(
      match[1]
    )
  );
}


function isBcciRelativeDate(
  value
) {
  const text =
    cleanText(
      value
    )
      .toLowerCase();


  /*
   * Examples:
   *
   * 1d ago
   * 6h ago
   * 32m ago
   */
  return (
    /^\d+\s*[dhm]\s*ago$/i.test(
      text
    ) ||
    /^\d+\s*(?:day|days|hour|hours|minute|minutes)\s+ago$/i.test(
      text
    )
  );
}


function collectBcciNewsCandidates(
  html,
  listingUrl
) {
  const $ =
    cheerio.load(
      html
    );


  const candidatesByUrl =
    new Map();


  let cardsFound =
    0;

  let invalidCards =
    0;


  $(
    'a[data-testid^="all-news-card-"][href]'
  ).each(
    (_, anchor) => {
      const link =
        $(anchor);


      /*
       * There can be desktop/mobile
       * duplicates, so we'll deduplicate
       * by article URL.
       */
      const href =
        cleanText(
          link.attr(
            "href"
          )
        );


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "bcci.tv"
        ) {
          return;
        }


        if (
          !parsed.pathname
            .toLowerCase()
            .startsWith(
              "/news/article/"
            )
        ) {
          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        return;
      }


      cardsFound +=
        1;


      /*
       * data-analytics-element-text has
       * cleaner headline text than some
       * rendered HTML titles.
       */
      const title =
        cleanHeadline(
          link.attr(
            "data-analytics-element-text"
          ) ||
          link
            .find(
              '[data-testid$="-title"]'
            )
            .first()
            .text()
        );


      const dateText =
        cleanText(
          link
            .find(
              '[data-testid$="-date"]'
            )
            .first()
            .text()
        );


      if (
        !title ||
        title.length <
          5 ||
        !dateText
      ) {
        invalidCards +=
          1;

        return;
      }


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      candidatesByUrl.set(
        key,
        {
          title,
          url:
            articleUrl,

          dateText,

          date:
            parseBcciExactDate(
              dateText
            ),

          needsArticlePage:
            isBcciRelativeDate(
              dateText
            ),
        }
      );
    }
  );


  return {
    cardsFound,

    invalidCards,

    candidates: [
      ...candidatesByUrl.values(),
    ],
  };
}


/*
 * Extract exact publication date from
 * a BCCI article page.
 */
function extractBcciArticleDate(
  html
) {
  const $ =
    cheerio.load(
      html
    );


  /*
   * Structured metadata first.
   */
  const metadataValues = [
    $(
      'meta[property="article:published_time"]'
    ).attr(
      "content"
    ),

    $(
      'meta[itemprop="datePublished"]'
    ).attr(
      "content"
    ),

    $(
      'meta[name="date"]'
    ).attr(
      "content"
    ),

    $(
      "time[datetime]"
    )
      .first()
      .attr(
        "datetime"
      ),
  ];


  for (
    const value of
    metadataValues
  ) {
    const parsed =
      parseBcciExactDate(
        value
      );


    if (
      parsed
    ) {
      return parsed;
    }
  }


  /*
   * Then look for visible date fields.
   */
  const dateElements =
    $(
      'time, [data-testid*="date"], [class*="date"], [class*="publish"]'
    )
      .toArray()
      .slice(
        0,
        40
      );


  for (
    const element of
    dateElements
  ) {
    const parsed =
      parseBcciExactDate(
        $(element).text()
      );


    if (
      parsed
    ) {
      return parsed;
    }
  }


  return null;
}


async function scrapeBcciNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  /*
   * IMPORTANT:
   * Ignore old platform/type parameters
   * and fetch the current filtered page.
   */
  const listingUrl =
    getBcciInternationalMenNewsUrl();


  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      listingUrl
    );


  const collected =
    collectBcciNewsCandidates(
      html,
      finalUrl
    );


  const candidates =
    collected.candidates;


  const resultsByUrl =
    new Map();


  let articlePagesFetched =
    0;

  let relativeDateCards =
    0;

  let exactListingDates =
    0;

  let invalidArticles =
    collected.invalidCards;


  /*
   * Resolve recent relative-date cards.
   *
   * Usually only the newest handful
   * require this.
   */
  const relativeCandidates =
    candidates.filter(
      (
        candidate
      ) =>
        candidate.needsArticlePage
    );


  relativeDateCards =
    relativeCandidates.length;


  const resolvedDatesByUrl =
    new Map();


  const concurrency =
    5;


  for (
    let index = 0;
    index <
    relativeCandidates.length;
    index +=
    concurrency
  ) {
    const batch =
      relativeCandidates.slice(
        index,
        index +
          concurrency
      );


    const batchResults =
      await Promise.all(
        batch.map(
          async (
            candidate
          ) => {
            try {
              const {
                html:
                  articleHtml,

                finalUrl:
                  articleFinalUrl,
              } =
                await fetchHtmlForArticle(
                  candidate.url
                );


              articlePagesFetched +=
                1;


              const articleDate =
                extractBcciArticleDate(
                  articleHtml
                );


              return {
                originalUrl:
                  candidate.url,

                finalUrl:
                  articleFinalUrl,

                date:
                  articleDate,
              };
            } catch {
              return {
                originalUrl:
                  candidate.url,

                finalUrl:
                  candidate.url,

                date:
                  null,
              };
            }
          }
        )
      );


    for (
      const item of
      batchResults
    ) {
      resolvedDatesByUrl.set(
        item.originalUrl,
        item
      );
    }
  }


  for (
    const candidate of
    candidates
  ) {
    let articleDate =
      candidate.date;


    let articleUrl =
      candidate.url;


    if (
      candidate.needsArticlePage
    ) {
      const resolved =
        resolvedDatesByUrl.get(
          candidate.url
        );


      if (
        resolved
      ) {
        articleDate =
          resolved.date;

        articleUrl =
          resolved.finalUrl ||
          candidate.url;
      }
    } else if (
      articleDate
    ) {
      exactListingDates +=
        1;
    }


    if (
      !articleDate
    ) {
      invalidArticles +=
        1;

      continue;
    }


    /*
     * Inclusive selected date.
     */
    if (
      articleDate <
      selectedStart
    ) {
      continue;
    }


    const row =
      createResultRow({
        organizationName:
          "Board of Control for Cricket in India",

        date:
          isoDate(
            articleDate
          ),

        title:
          candidate.title,

        url:
          articleUrl,
      });


    const key =
      articleUrlKey(
        articleUrl,
        sourceUrl
      );


    if (!key) {
      invalidArticles +=
        1;

      continue;
    }


    resultsByUrl.set(
      key,
      row
    );
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    collected.cardsFound ===
    0
  ) {
    warning =
      "No BCCI International Men's news cards were detected.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "BCCI International Men's articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidArticles >
    0
  ) {
    warning =
      `Returned ${results.length} BCCI article(s). ` +
      `${invalidArticles} item(s) were skipped because their publication date or required information could not be confirmed.`;
  }


  return {
    organizationName:
      "Board of Control for Cricket in India",

    sourceName:
      "Board of Control for Cricket in India",

    scannedCandidates:
      candidates.length,

    results,

    warning,

    diagnostics: {
      adapter:
        "bcci-international-men-news",

      requestedSourceUrl:
        sourceUrl,

      actualListingUrl:
        listingUrl,

      cardsFound:
        collected.cardsFound,

      candidatesFound:
        candidates.length,

      relativeDateCards,

      exactListingDates,

      articlePagesFetched,

      invalidArticles,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   ICC NEWS ADAPTER

   Listing:
   https://www.icc-cricket.com/news

   ICC listing dates are relative:
   23m
   1h
   11h
   1d
   2d

   Therefore we DO NOT use listing dates for filtering.

   We collect article URLs from the listing, open each article,
   extract its exact publication date, and then apply the
   selected date filter.
========================================================= */

function isIccNewsUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    const path = url.pathname
      .replace(/\/+$/, "")
      .toLowerCase();

    return (
      host === "icc-cricket.com" &&
      path === "/news"
    );
  } catch {
    return false;
  }
}


function isIccArticleUrl(value, baseUrl) {
  try {
    const url = new URL(
      value,
      baseUrl
    );

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (
      host !==
      "icc-cricket.com"
    ) {
      return false;
    }

    const path = url.pathname
      .toLowerCase();

    /*
     * Normal ICC articles:
     *
     * /news/article-slug
     *
     * Tournament articles can also be:
     *
     * /tournaments/.../news/article-slug
     */
    if (
      !path.includes("/news/")
    ) {
      return false;
    }

    /*
     * Exclude category navigation.
     */
    if (
      path.includes(
        "/news/category/"
      )
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}


function collectIccNewsCandidates(
  html,
  listingUrl
) {
  const $ = cheerio.load(
    html
  );

  const candidatesByUrl =
    new Map();

  let linksScanned = 0;


  /*
   * ICC article cards on the actual
   * news listing contain a <time>.
   *
   * This conveniently excludes things
   * like Editor's Picks/navigation links.
   */
  $("a[href]").each(
    (_, element) => {
      const link = $(element);

      const href = cleanText(
        link.attr("href")
      );

      if (
        !href ||
        !link.find("time").length
      ) {
        return;
      }


      let articleUrl;

      try {
        articleUrl =
          new URL(
            href,
            listingUrl
          ).toString();
      } catch {
        return;
      }


      if (
        !isIccArticleUrl(
          articleUrl,
          listingUrl
        )
      ) {
        return;
      }


      linksScanned += 1;


      /*
       * Featured ICC cards usually use h2.
       *
       * Latest News cards usually use
       * a bold <p>.
       */
      let title =
        cleanHeadline(
          link
            .find("h1, h2, h3")
            .first()
            .attr("title") ||
          link
            .find("h1, h2, h3")
            .first()
            .text()
        );


      if (!title) {
        title =
          cleanHeadline(
            link
              .find(
                "p.font-icc.font-bold"
              )
              .first()
              .text()
          );
      }


      if (!title) {
        title =
          cleanHeadline(
            link
              .find("img[alt]")
              .first()
              .attr("alt")
          );
      }


      if (
        !title ||
        title.length < 5
      ) {
        return;
      }


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        return;
      }


      /*
       * The same story can appear in the
       * featured area and Latest News.
       * Map removes duplicates.
       */
      candidatesByUrl.set(
        key,
        {
          title,
          url: articleUrl,

          /*
           * Stored only for diagnostics.
           * We DO NOT use it as a real date.
           */
          listingTime:
            cleanText(
              link
                .find("time")
                .first()
                .text()
            ),
        }
      );
    }
  );


  return {
    linksScanned,

    candidates: [
      ...candidatesByUrl.values(),
    ],
  };
}


/*
 * ICC article pages show dates such as:
 *
 * 8 October, 2026
 *
 * Metadata may instead contain:
 *
 * 2026-10-08T...
 */
function parseIccArticleDate(
  value
) {
  const text = cleanText(
    value
  );

  if (!text) {
    return null;
  }


  /*
   * ISO metadata.
   */
  const isoMatch =
    text.match(
      /\b(20\d{2})-(\d{2})-(\d{2})\b/
    );


  if (isoMatch) {
    return dateFromParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );
  }


  /*
   * ICC visible format:
   *
   * 8 October, 2026
   *
   * Also accepts abbreviated month names.
   */
  const visibleMatch =
    text.match(
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec),?\s+(20\d{2})\b/i
    );


  if (
    visibleMatch
  ) {
    return parseDateText(
      visibleMatch[0]
    );
  }


  return null;
}


function extractIccArticleDate(html) {
  const $ = cheerio.load(html);

  /*
   * ICC provides the exact publication timestamp
   * directly in the article metadata:
   *
   * <meta
   *   property="article:published_time"
   *   content="2026-10-08T10:35:23.435Z"
   * />
   */
  const publishedTime = cleanText(
    $('meta[property="article:published_time"]').attr("content")
  );

  if (publishedTime) {
    const date = new Date(publishedTime);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }


  /*
   * Backup: ICC also prints the exact date visibly:
   *
   * <time class="font-date">
   *   8 October, 2026
   * </time>
   */
  const visibleDate = cleanText(
    $("article time.font-date")
      .first()
      .text()
  );

  if (visibleDate) {
    const match = visibleDate.match(
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(20\d{2})\b/i
    );

    if (match) {
      const months = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11,
      };

      return new Date(
        Date.UTC(
          Number(match[3]),
          months[
            match[2].toLowerCase()
          ],
          Number(match[1])
        )
      );
    }
  }


  /*
   * Final backup: JSON-LD.
   */
  let jsonLdDate = null;

  $('script[type="application/ld+json"]').each(
    (_, element) => {
      if (jsonLdDate) {
        return;
      }

      try {
        const raw = $(element).html();

        if (!raw) {
          return;
        }

        const data = JSON.parse(raw);

        const objects =
          Array.isArray(data)
            ? data
            : [data];

        for (const item of objects) {
          if (
            item &&
            typeof item === "object" &&
            item.datePublished
          ) {
            const parsed =
              new Date(
                item.datePublished
              );

            if (
              !Number.isNaN(
                parsed.getTime()
              )
            ) {
              jsonLdDate =
                parsed;

              break;
            }
          }
        }
      } catch {
        // Ignore malformed JSON-LD.
      }
    }
  );


  return jsonLdDate;
}


async function extractIccArticleDetails(
  candidate
) {
  try {
    /*
     * Use the normal HTML fetcher here.
     *
     * ICC article pages are normal server-rendered HTML
     * and already contain article:published_time.
     */
    const {
      html,
      finalUrl,
    } =
      await fetchHtml(
        candidate.url
      );


    const date =
      extractIccArticleDate(
        html
      );


    return {
      title:
        candidate.title,

      url:
        finalUrl ||
        candidate.url,

      date,

      listingTime:
        candidate.listingTime,
    };
  } catch (error) {
    console.error(
      "[ICC] Article fetch/date error:",
      candidate.url,
      error?.message ||
        error
    );

    return {
      title:
        candidate.title,

      url:
        candidate.url,

      date:
        null,

      listingTime:
        candidate.listingTime,
    };
  }
}


async function scrapeIccNews(
  sourceUrl,
  sinceDate
) {
  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );


  const collected =
    collectIccNewsCandidates(
      html,
      finalUrl
    );


  /*
   * Open article pages concurrently.
   */
  const articleDetails =
    await mapWithConcurrency(
      collected.candidates,
      6,
      extractIccArticleDetails
    );


  const resultsByUrl =
    new Map();


  let datesFound = 0;

  let datesMissing = 0;


  for (
    const article of
    articleDetails
  ) {
    if (
      !article.date
    ) {
      datesMissing += 1;
      continue;
    }


    datesFound += 1;


    /*
     * Inclusive start date.
     */
    if (
      article.date <
      selectedStart
    ) {
      continue;
    }


    const row =
      createResultRow({
        organizationName:
          "International Cricket Council",

        date:
          isoDate(
            article.date
          ),

        title:
          article.title,

        url:
          article.url,
      });


    const key =
      articleUrlKey(
        article.url,
        sourceUrl
      );


    if (!key) {
      continue;
    }


    resultsByUrl.set(
      key,
      row
    );
  }


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning = "";


  if (
    collected.candidates.length === 0
  ) {
    warning =
      "No ICC news article cards were detected on the listing page.";
  } else if (
    datesFound === 0
  ) {
    warning =
      "ICC articles were detected, but exact publication dates could not be extracted from their article pages.";
  } else if (
    results.length === 0
  ) {
    warning =
      "ICC articles were detected successfully, but none were on or after the selected date.";
  } else if (
    datesMissing > 0
  ) {
    warning =
      `Returned ${results.length} ICC article(s). ` +
      `${datesMissing} article(s) were skipped because their exact publication date could not be confirmed.`;
  }


  return {
    organizationName:
      "International Cricket Council",

    sourceName:
      "International Cricket Council",

    scannedCandidates:
      collected.candidates.length,

    results,

    warning,

    diagnostics: {
      adapter:
        "icc-article-page-exact-dates",

      listingUrl:
        finalUrl,

      linksScanned:
        collected.linksScanned,

      candidatesFound:
        collected.candidates.length,

      articlePagesFetched:
        articleDetails.length,

      datesFound,

      datesMissing,

      articlesReturned:
        results.length,
    },
  };
}

/* =========================================================
   CRICKET AUSTRALIA NEWS ADAPTER

   Input:
   https://www.cricket.com.au/news

   IMPORTANT:
   The page visually shows:
   - 54m ago
   - 3h ago
   - 22h ago

   But every article card contains the exact timestamp:

   <time
     class="published-ago ..."
     datetime="2026-10-08T10:30:00Z"
   >
     54m ago
   </time>

   We IGNORE the relative text entirely and use the exact
   datetime attribute.

   No individual article-page requests are required.
========================================================= */

function isCricketAustraliaNewsUrl(
  sourceUrl
) {
  try {
    const url =
      new URL(
        sourceUrl
      );

    const host =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    const path =
      url.pathname
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase();

    return (
      host ===
        "cricket.com.au" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


/*
 * Cricket Australia gives exact timestamps:
 *
 * 2026-10-08T10:30:00Z
 * 2026-10-07T12:47:19Z
 *
 * We intentionally take ONLY the calendar date.
 */
function parseCricketAustraliaDate(
  value
) {
  const text =
    cleanText(
      value
    );

  if (!text) {
    return null;
  }


  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );


  if (!match) {
    return null;
  }


  return dateFromParts(
    Number(
      match[1]
    ),

    Number(
      match[2]
    ) - 1,

    Number(
      match[3]
    )
  );
}


function extractCricketAustraliaNews(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(
      html
    );


  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const resultsByUrl =
    new Map();


  let cardsFound =
    0;

  let datedCardsFound =
    0;

  let relativeLabelsIgnored =
    0;

  let invalidCards =
    0;


  /*
   * Main Cricket Australia news listing.
   *
   * Each item contains:
   *
   * <a class="o-media-pod__link" href="/news/...">
   *   ...
   *   <h3 class="o-media-pod__heading">
   *      Headline
   *   </h3>
   *
   *   <time
   *      class="published-ago ..."
   *      datetime="2026-10-08T10:30:00Z"
   *   >
   *      54m ago
   *   </time>
   * </a>
   */
  $(
    ".js-content-grid-list > li.w-content-grid__item"
  ).each(
    (_, item) => {
      const root =
        $(item);


      const link =
        root
          .find(
            "a.o-media-pod__link[href]"
          )
          .first();


      if (
        !link.length
      ) {
        return;
      }


      cardsFound +=
        1;


      const href =
        cleanText(
          link.attr(
            "href"
          )
        );


      const title =
        cleanHeadline(
          root
            .find(
              ".o-media-pod__heading"
            )
            .first()
            .text()
        );


      const timeElement =
        root
          .find(
            "time[datetime]"
          )
          .first();


      /*
       * Visible text might be:
       *
       * 54m ago
       * 3h ago
       * 22h ago
       * 07 Oct 2026
       *
       * We DON'T use any of it.
       */
      const visibleTime =
        cleanText(
          timeElement.text()
        );


      if (
        visibleTime
      ) {
        relativeLabelsIgnored +=
          1;
      }


      /*
       * This is the value we care about.
       *
       * Example:
       * 2026-10-08T10:30:00Z
       */
      const exactTimestamp =
        cleanText(
          timeElement.attr(
            "datetime"
          )
        );


      const articleDate =
        parseCricketAustraliaDate(
          exactTimestamp
        );


      if (
        articleDate
      ) {
        datedCardsFound +=
          1;
      }


      let articleUrl =
        "";


      try {
        const parsed =
          new URL(
            href,
            listingUrl
          );


        const host =
          parsed.hostname
            .toLowerCase()
            .replace(
              /^www\./,
              ""
            );


        if (
          host !==
          "cricket.com.au"
        ) {
          invalidCards +=
            1;

          return;
        }


        /*
         * Real CA article URL:
         *
         * /news/4588660/article-slug
         */
        if (
          !/^\/news\/\d+\/[^/]+\/?$/i.test(
            parsed.pathname
          )
        ) {
          invalidCards +=
            1;

          return;
        }


        parsed.hash =
          "";

        articleUrl =
          parsed.toString();
      } catch {
        invalidCards +=
          1;

        return;
      }


      if (
        !title ||
        title.length <
          5 ||
        !articleDate ||
        !articleUrl
      ) {
        invalidCards +=
          1;

        return;
      }


      /*
       * Normal selected-date rule.
       *
       * Example:
       *
       * selected:
       * 2026-10-08
       *
       * timestamp:
       * 2026-10-08T10:30:00Z
       *
       * date:
       * 2026-10-08
       *
       * INCLUDED
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Cricket Australia",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !==
        0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning =
    "";


  if (
    cardsFound ===
    0
  ) {
    warning =
      "No Cricket Australia news cards were detected.";
  } else if (
    datedCardsFound ===
    0
  ) {
    warning =
      "Cricket Australia articles were detected, but their exact publication dates could not be extracted.";
  } else if (
    results.length ===
    0
  ) {
    warning =
      "Cricket Australia articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards >
    0
  ) {
    warning =
      `Returned ${results.length} Cricket Australia article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Cricket Australia",

    sourceName:
      "Cricket Australia",

    scannedCandidates:
      datedCardsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "cricket-australia-exact-listing-datetime",

      cardsFound,

      datedCardsFound,

      relativeLabelsIgnored,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}


async function scrapeCricketAustraliaNews(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );


  return extractCricketAustraliaNews(
    html,
    finalUrl,
    sinceDate
  );
}

/* =========================================================
   PERTH SCORCHERS NEWS ADAPTER

   Input:
   https://www.perthscorchers.com.au/News

   IMPORTANT:

   The visible date may say:
   - 9h ago
   - 3h ago
   - 06 Oct 2026

   But the listing HTML contains:

   <time datetime="2026-10-08T03:24:52Z">
     9h ago
   </time>

   Therefore we IGNORE the visible text and use the exact
   datetime attribute.

   No article-page requests are required.
========================================================= */

function isPerthScorchersNewsUrl(sourceUrl) {
  try {
    const url =
      new URL(sourceUrl);

    const host =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    const path =
      url.pathname
        .replace(/\/+$/, "")
        .toLowerCase();

    return (
      host ===
        "perthscorchers.com.au" &&
      path ===
        "/news"
    );
  } catch {
    return false;
  }
}


/*
 * Example input:
 *
 * 2026-10-08T03:24:52Z
 *
 * Output:
 *
 * Date representing 2026-10-08
 */
function parsePerthScorchersDate(
  value
) {
  const text =
    cleanText(value);

  if (!text) {
    return null;
  }


  const match =
    text.match(
      /^(20\d{2})-(\d{2})-(\d{2})/
    );


  if (!match) {
    return null;
  }


  return dateFromParts(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}


/*
 * Perth article URLs look like:
 *
 * /news/4588263/tickets-for-historic-chennai-clash-on-sale-saturday
 */
function normalizePerthScorchersArticleUrl(
  href,
  listingUrl
) {
  const value =
    cleanText(href);

  if (!value) {
    return "";
  }


  try {
    const url =
      new URL(
        value,
        listingUrl
      );


    const host =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");


    if (
      host !==
      "perthscorchers.com.au"
    ) {
      return "";
    }


    if (
      !/^\/news\/\d+\/[^/]+\/?$/i.test(
        url.pathname
      )
    ) {
      return "";
    }


    url.hash = "";


    return url.toString();
  } catch {
    return "";
  }
}


function extractPerthScorchersNews(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(html);


  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const resultsByUrl =
    new Map();


  let cardsFound = 0;

  let datedCardsFound = 0;

  let invalidCards = 0;

  let relativeLabelsIgnored = 0;


  /*
   * Actual Perth Scorchers structure:
   *
   * <li class="w-content-grid__item">
   *   <article class="o-media-pod">
   *
   *     <a
   *       href="/news/4588263/..."
   *       class="o-media-pod__link"
   *     >
   *
   *       <h3 class="o-media-pod__heading">
   *         Title
   *       </h3>
   *
   *       <time
   *         class="published-ago ..."
   *         datetime="2026-10-08T03:24:52Z"
   *       >
   *         9h ago
   *       </time>
   *
   *     </a>
   *   </article>
   * </li>
   */
  $(
    ".w-content-grid__list > li.w-content-grid__item"
  ).each(
    (_, item) => {
      const card =
        $(item);


      const link =
        card
          .find(
            "a.o-media-pod__link[href]"
          )
          .first();


      if (
        !link.length
      ) {
        return;
      }


      cardsFound += 1;


      /*
       * URL
       */
      const articleUrl =
        normalizePerthScorchersArticleUrl(
          link.attr("href"),
          listingUrl
        );


      /*
       * Title
       */
      let title =
        cleanHeadline(
          card
            .find(
              ".o-media-pod__heading"
            )
            .first()
            .text()
        );


      /*
       * Fallback to anchor title.
       */
      if (!title) {
        title =
          cleanHeadline(
            link.attr("title")
          );
      }


      /*
       * Exact publication timestamp.
       *
       * THIS is what matters.
       *
       * We deliberately ignore the text:
       *
       * 9h ago
       *
       * and read:
       *
       * datetime="2026-10-08T03:24:52Z"
       */
      const timeElement =
        card
          .find(
            "time[datetime]"
          )
          .first();


      const exactTimestamp =
        cleanText(
          timeElement.attr(
            "datetime"
          )
        );


      const visibleLabel =
        cleanText(
          timeElement.text()
        );


      if (
        visibleLabel &&
        (
          /\bago\b/i.test(
            visibleLabel
          ) ||
          /^\d+\s*[hm]\b/i.test(
            visibleLabel
          )
        )
      ) {
        relativeLabelsIgnored += 1;
      }


      const articleDate =
        parsePerthScorchersDate(
          exactTimestamp
        );


      if (
        articleDate
      ) {
        datedCardsFound += 1;
      }


      if (
        !title ||
        title.length < 5 ||
        !articleUrl ||
        !articleDate
      ) {
        invalidCards += 1;

        return;
      }


      /*
       * Inclusive selected date.
       *
       * If selected:
       *
       * 2026-10-06
       *
       * then:
       *
       * 2026-10-06 INCLUDED
       * 2026-10-07 INCLUDED
       * 2026-10-08 INCLUDED
       *
       * 2026-10-05 EXCLUDED
       */
      if (
        articleDate <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Perth Scorchers",

          date:
            isoDate(
              articleDate
            ),

          title,

          url:
            articleUrl,
        });


      const key =
        articleUrlKey(
          articleUrl,
          listingUrl
        );


      if (!key) {
        invalidCards += 1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning = "";


  if (
    cardsFound === 0
  ) {
    warning =
      "No Perth Scorchers news cards were detected.";
  } else if (
    datedCardsFound === 0
  ) {
    warning =
      "Perth Scorchers news cards were detected, but exact publication dates could not be extracted.";
  } else if (
    results.length === 0
  ) {
    warning =
      "Perth Scorchers articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards > 0
  ) {
    warning =
      `Returned ${results.length} Perth Scorchers article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Perth Scorchers",

    sourceName:
      "Perth Scorchers",

    scannedCandidates:
      datedCardsFound,

    results,

    warning,

    diagnostics: {
      adapter:
        "perth-scorchers-exact-listing-datetime",

      listingUrl,

      cardsFound,

      datedCardsFound,

      relativeLabelsIgnored,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}


async function scrapePerthScorchersNews(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );


  return extractPerthScorchersNews(
    html,
    finalUrl,
    sinceDate
  );
}

/* =========================================================
   ROYAL CHALLENGERS BENGALURU (RCB) NEWS ADAPTER

   Input:
   https://www.royalchallengers.com/rcb-cricket-news

   RCB listing cards contain:

   Title:
   <a href="/rcb-cricket-news/news/...">
     Smriti Mandhana appointed...
   </a>

   Date:
   <span class="fld-dte">06</span>
   <span class="fld-mth">Oct</span>

   The listing does not show the year directly.

   We obtain the year from image paths such as:
   /2026-10/...

   Fallback:
   infer year using the current date.

   We ONLY include normal NEWS articles:
   /rcb-cricket-news/news/...

   We exclude:
   /lifestyle/
   /around-the-world/
========================================================= */

function isRcbNewsUrl(sourceUrl) {
  try {
    const url =
      new URL(sourceUrl);

    const host =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    const path =
      url.pathname
        .replace(/\/+$/, "")
        .toLowerCase();

    return (
      host ===
        "royalchallengers.com" &&
      path ===
        "/rcb-cricket-news"
    );
  } catch {
    return false;
  }
}


/*
 * RCB article URLs that we want:
 *
 * /rcb-cricket-news/news/article-slug
 */
function normalizeRcbArticleUrl(
  href,
  listingUrl
) {
  const value =
    cleanText(href);

  if (!value) {
    return "";
  }


  try {
    const url =
      new URL(
        value,
        listingUrl
      );


    const host =
      url.hostname
        .toLowerCase()
        .replace(/^www\./, "");


    if (
      host !==
      "royalchallengers.com"
    ) {
      return "";
    }


    const path =
      url.pathname
        .replace(/\/+$/, "");


    if (
      !/^\/rcb-cricket-news\/news\/[^/]+$/i.test(
        path
      )
    ) {
      return "";
    }


    /*
     * Force HTTPS because some RCB
     * featured links are written as http.
     */
    url.protocol =
      "https:";


    url.hash =
      "";


    return url.toString();
  } catch {
    return "";
  }
}


function rcbMonthNumber(
  value
) {
  const month =
    cleanText(value)
      .toLowerCase()
      .slice(0, 3);


  const months = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };


  return months[month];
}


/*
 * Try to obtain the year from the
 * card image URL.
 *
 * Examples:
 *
 * /2026-10/image.jpg
 * /public/2026-10/image.jpg
 */
function extractRcbYearFromCard(
  $,
  card
) {
  const images =
    card
      .find("img")
      .toArray();


  for (
    const image of
    images
  ) {
    const element =
      $(image);


    const candidates = [
      element.attr("data-src"),
      element.attr("src"),
    ];


    for (
      const value of
      candidates
    ) {
      const text =
        cleanText(value);


      if (!text) {
        continue;
      }


      const match =
        text.match(
          /\/(20\d{2})-\d{2}\//
        );


      if (
        match
      ) {
        return Number(
          match[1]
        );
      }
    }
  }


  return null;
}


/*
 * Example:
 *
 * day = 07
 * month = Oct
 * yearHint = 2026
 */
function parseRcbListingDate(
  dayValue,
  monthValue,
  yearHint = null
) {
  const day =
    Number(
      cleanText(
        dayValue
      )
    );


  const month =
    rcbMonthNumber(
      monthValue
    );


  if (
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31 ||
    month === undefined
  ) {
    return null;
  }


  /*
   * Preferred:
   * year taken from image URL.
   */
  if (
    Number.isInteger(yearHint) &&
    yearHint >= 2000 &&
    yearHint <= 2100
  ) {
    return dateFromParts(
      yearHint,
      month,
      day
    );
  }


  /*
   * Fallback:
   *
   * infer from current UTC year.
   *
   * New Year protection:
   * If candidate appears more than
   * 45 days in the future, it belongs
   * to the previous year.
   */
  const now =
    new Date();


  let year =
    now.getUTCFullYear();


  let candidate =
    dateFromParts(
      year,
      month,
      day
    );


  const futureLimit =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 45
      )
    );


  if (
    candidate >
    futureLimit
  ) {
    year -= 1;

    candidate =
      dateFromParts(
        year,
        month,
        day
      );
  }


  return candidate;
}


/*
 * Extract one RCB card.
 *
 * Works for both:
 *
 * FEATURED
 * and
 * LATEST
 */
function extractRcbCard(
  $,
  card,
  listingUrl
) {
  /*
   * Find only NEWS links.
   */
  const link =
    card
      .find(
        'a[href*="/rcb-cricket-news/news/"]'
      )
      .filter(
        (_, element) => {
          const href =
            cleanText(
              $(element)
                .attr("href")
            );

          return /^https?:\/\/(?:www\.)?royalchallengers\.com\/rcb-cricket-news\/news\//i.test(
            href
          ) ||
          /^\/rcb-cricket-news\/news\//i.test(
            href
          );
        }
      )
      .first();


  if (
    !link.length
  ) {
    return null;
  }


  const articleUrl =
    normalizeRcbArticleUrl(
      link.attr("href"),
      listingUrl
    );


  if (
    !articleUrl
  ) {
    return null;
  }


  /*
   * Use link text as headline.
   *
   * Featured cards have .grp-tit.
   * Latest cards have h2.
   */
  let title =
    cleanHeadline(
      link.text()
    );


  if (
    !title
  ) {
    title =
      cleanHeadline(
        card
          .find(
            ".grp-tit a, h2 a"
          )
          .first()
          .text()
      );
  }


  if (
    !title ||
    title.length < 5
  ) {
    return null;
  }


  const day =
    cleanText(
      card
        .find(
          ".fld-dte"
        )
        .first()
        .text()
    );


  const month =
    cleanText(
      card
        .find(
          ".fld-mth"
        )
        .first()
        .text()
    );


  const yearHint =
    extractRcbYearFromCard(
      $,
      card
    );


  const articleDate =
    parseRcbListingDate(
      day,
      month,
      yearHint
    );


  if (
    !articleDate
  ) {
    return null;
  }


  return {
    title,
    url:
      articleUrl,

    date:
      articleDate,

    yearHint,
  };
}


function extractRcbNews(
  html,
  listingUrl,
  sinceDate
) {
  const $ =
    cheerio.load(html);


  const selectedStart =
    new Date(
      `${sinceDate}T00:00:00.000Z`
    );


  const resultsByUrl =
    new Map();


  let featuredCardsFound =
    0;

  let latestCardsFound =
    0;

  let validArticles =
    0;

  let invalidCards =
    0;


  /*
   * =====================================================
   * FEATURED ARTICLES
   *
   * Structure:
   *
   * .news_landing
   *   .grp-tit
   *   .fld-dte
   *   .fld-mth
   * =====================================================
   */
  $(
    ".news_landing"
  ).each(
    (_, element) => {
      const card =
        $(element);


      featuredCardsFound +=
        1;


      const article =
        extractRcbCard(
          $,
          card,
          listingUrl
        );


      if (
        !article
      ) {
        invalidCards +=
          1;

        return;
      }


      validArticles +=
        1;


      if (
        article.date <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Royal Challengers Bengaluru",

          date:
            isoDate(
              article.date
            ),

          title:
            article.title,

          url:
            article.url,
        });


      const key =
        articleUrlKey(
          article.url,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      resultsByUrl.set(
        key,
        row
      );
    }
  );


  /*
   * =====================================================
   * LATEST ARTICLES
   *
   * Structure:
   *
   * .views-row
   *   .node--type-article
   *   h2 a
   *   .fld-dte
   *   .fld-mth
   *
   * IMPORTANT:
   *
   * The page also contains Lifestyle
   * and Around The World blocks using
   * the same markup.
   *
   * Therefore extractRcbCard() only
   * accepts URLs under:
   *
   * /rcb-cricket-news/news/
   * =====================================================
   */
  $(
    ".views-row"
  ).each(
    (_, element) => {
      const card =
        $(element);


      /*
       * Quickly reject cards that are
       * not normal RCB NEWS articles.
       */
      const newsLink =
        card
          .find(
            'a[href*="/rcb-cricket-news/news/"]'
          )
          .first();


      if (
        !newsLink.length
      ) {
        return;
      }


      latestCardsFound +=
        1;


      const article =
        extractRcbCard(
          $,
          card,
          listingUrl
        );


      if (
        !article
      ) {
        invalidCards +=
          1;

        return;
      }


      validArticles +=
        1;


      /*
       * Inclusive selected date.
       */
      if (
        article.date <
        selectedStart
      ) {
        return;
      }


      const row =
        createResultRow({
          organizationName:
            "Royal Challengers Bengaluru",

          date:
            isoDate(
              article.date
            ),

          title:
            article.title,

          url:
            article.url,
        });


      const key =
        articleUrlKey(
          article.url,
          listingUrl
        );


      if (!key) {
        invalidCards +=
          1;

        return;
      }


      /*
       * Featured and Latest may occasionally
       * contain the same article.
       *
       * Map automatically deduplicates it.
       */
      resultsByUrl.set(
        key,
        row
      );
    }
  );


  const results = [
    ...resultsByUrl.values(),
  ].sort(
    (a, b) => {
      const dateCompare =
        b.date.localeCompare(
          a.date
        );


      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }


      return a.title.localeCompare(
        b.title
      );
    }
  );


  let warning = "";


  if (
    featuredCardsFound === 0 &&
    latestCardsFound === 0
  ) {
    warning =
      "No Royal Challengers Bengaluru news cards were detected.";
  } else if (
    validArticles === 0
  ) {
    warning =
      "RCB news cards were detected, but their publication dates or article information could not be extracted.";
  } else if (
    results.length === 0
  ) {
    warning =
      "RCB articles were detected successfully, but none were on or after the selected date.";
  } else if (
    invalidCards > 0
  ) {
    warning =
      `Returned ${results.length} RCB article(s). ` +
      `${invalidCards} card(s) were skipped because required information was missing.`;
  }


  return {
    organizationName:
      "Royal Challengers Bengaluru",

    sourceName:
      "Royal Challengers Bengaluru",

    scannedCandidates:
      validArticles,

    results,

    warning,

    diagnostics: {
      adapter:
        "rcb-listing-date",

      featuredCardsFound,

      latestCardsFound,

      validArticles,

      invalidCards,

      articlesReturned:
        results.length,
    },
  };
}


async function scrapeRcbNews(
  sourceUrl,
  sinceDate
) {
  const {
    html,
    finalUrl,
  } =
    await fetchHtml(
      sourceUrl
    );


  return extractRcbNews(
    html,
    finalUrl,
    sinceDate
  );
}

/* =========================================================
   FETCH Adapter
========================================================= */

async function fetchHtmlAttempt(
  url,
  timeoutMs
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            "User-Agent":
              USER_AGENT,

            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

            "Accept-Language":
              "en-GB,en-US;q=0.9,en;q=0.8",

            "Cache-Control":
              "no-cache",

            Pragma:
              "no-cache",
          },

          redirect:
            "follow",

          cache:
            "no-store",

          signal:
            controller.signal,
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Website returned HTTP ${response.status} ${response.statusText}.`
      );
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType
        .toLowerCase()
        .includes(
          "text/html"
        )
    ) {
      throw new Error(
        `Expected an HTML page but received "${
          contentType ||
          "unknown content type"
        }".`
      );
    }

    return {
      html:
        await response.text(),

      finalUrl:
        response.url ||
        url,
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function fetchHtml(
  url
) {
  let lastError =
    null;

  for (
    let attempt = 1;
    attempt <= 2;
    attempt += 1
  ) {
    try {
      return await fetchHtmlAttempt(
        url,
        25000
      );
    } catch (error) {
      lastError =
        error;

      if (
        error?.message?.startsWith(
          "Website returned HTTP"
        )
      ) {
        throw error;
      }

      if (
        attempt < 2
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              700
            )
        );
      }
    }
  }

  if (
    lastError?.name ===
    "AbortError"
  ) {
    throw new Error(
      "The website took too long to respond after two attempts."
    );
  }

  throw new Error(
    lastError?.message ||
      "The website could not be reached after two attempts."
  );
}

/* =========================================================
   API
========================================================= */

// export async function POST(
//   request
// ) {
//   try {
//     const {
//       url: rawUrl,
//       sinceDate,
//     } =
//       await request.json();

//     if (!rawUrl) {
//       return Response.json(
//         {
//           error:
//             "A source URL is required.",
//         },
//         {
//           status: 400,
//         }
//       );
//     }

//     if (
//       !/^\d{4}-\d{2}-\d{2}$/.test(
//         sinceDate || ""
//       )
//     ) {
//       return Response.json(
//         {
//           error:
//             "Provide a valid start date.",
//         },
//         {
//           status: 400,
//         }
//       );
//     }

//     const sourceUrl =
//       validatePublicUrl(
//         rawUrl
//       ).toString();

//     const selectedDate =
//       new Date(
//         `${sinceDate}T00:00:00.000Z`
//       );

//     if (
//       Number.isNaN(
//         selectedDate.getTime()
//       )
//     ) {
//       return Response.json(
//         {
//           error:
//             "Invalid start date.",
//         },
//         {
//           status: 400,
//         }
//       );
//     }

//     const today =
//       new Date();

//     today.setUTCHours(
//       23,
//       59,
//       59,
//       999
//     );

//     if (
//       selectedDate >
//       today
//     ) {
//       return Response.json(
//         {
//           error:
//             "The start date cannot be in the future.",
//         },
//         {
//           status: 400,
//         }
//       );
//     }

//     let output;

//     if (
//       isCplNewsUrl(
//         sourceUrl
//       )
//     ) {
//       output =
//         await scrapeCplNews(
//           sourceUrl,
//           sinceDate
//         );
//     } else if (
//       isSa20NewsUrl(
//         sourceUrl
//       )
//     ) {
//       output =
//         await scrapeSa20News(
//           sourceUrl,
//           sinceDate
//         );
//     } else if (
//       isPcaNewsUrl(
//         sourceUrl
//       )
//     ) {
//       output =
//         await scrapePcaNews(
//           sourceUrl,
//           sinceDate
//         );
//     } else if (
//       isCskNewsUrl(
//         sourceUrl
//       )
//     ) {
//       output =
//         await scrapeCskNews(
//           sourceUrl,
//           sinceDate
//         );
//     } else {
//       const {
//         html,
//         finalUrl,
//       } =
//         await fetchHtml(
//           sourceUrl
//         );

//       output =
//         extractArticlesGeneric(
//           html,
//           finalUrl,
//           sinceDate,
//           sourceUrl
//         );
//     }

//     console.log(
//       `[News scraper] ${sourceUrl}`,
//       output.diagnostics
//     );

//     return Response.json(
//       output
//     );
//   } catch (error) {
//     console.error(
//       error
//     );

//     return Response.json(
//       {
//         error:
//           error?.message ||
//           "Unexpected error while scraping the listing page.",
//       },
//       {
//         status: 500,
//       }
//     );
//   }
// }
// export async function POST(
//   request
// ) {
//   try {
//     const {
//       url: rawUrl,
//       sinceDate,
//     } =
//       await request.json();

//     if (!rawUrl) {
//       return Response.json(
//         {
//           error:
//             "A source URL is required.",
//         },
//         {
//           status: 400,
//         }
//       );
//     }

//     if (
//       !/^\d{4}-\d{2}-\d{2}$/.test(
//         sinceDate || ""
//       )
//     ) {
//       return Response.json(
//         {
//           error:
//             "Provide a valid start date.",
//         },
//         {
//           status: 400,
//         }
//       );
//     }

//     const sourceUrl =
//       validatePublicUrl(
//         rawUrl
//       ).toString();

//     const selectedDate =
//       new Date(
//         `${sinceDate}T00:00:00.000Z`
//       );

//     if (
//       Number.isNaN(
//         selectedDate.getTime()
//       )
//     ) {
//       return Response.json(
//         {
//           error:
//             "Invalid start date.",
//         },
//         {
//           status: 400,
//         }
//       );
//     }

//     const today =
//       new Date();

//     today.setUTCHours(
//       23,
//       59,
//       59,
//       999
//     );

//     if (
//       selectedDate >
//       today
//     ) {
//       return Response.json(
//         {
//           error:
//             "The start date cannot be in the future.",
//         },
//         {
//           status: 400,
//         }
//       );
//     }

//     let output;

//     /*
//      * =====================================================
//      * SITE-SPECIFIC ADAPTERS
//      * =====================================================
//      */

//     if (
//       isCplNewsUrl(
//         sourceUrl
//       )
//     ) {
//       output =
//         await scrapeCplNews(
//           sourceUrl,
//           sinceDate
//         );
//     } else if (
//       isSa20NewsUrl(
//         sourceUrl
//       )
//     ) {
//       output =
//         await scrapeSa20News(
//           sourceUrl,
//           sinceDate
//         );
//     } else if (
//       isPcaNewsUrl(
//         sourceUrl
//       )
//     ) {
//       output =
//         await scrapePcaNews(
//           sourceUrl,
//           sinceDate
//         );
//     } else if (
//       isCskNewsUrl(
//         sourceUrl
//       )
//     ) {
//       output =
//         await scrapeCskNews(
//           sourceUrl,
//           sinceDate
//         );
//     } else if (
//       isPunjabKingsNewsUrl(
//         sourceUrl
//       )
//     ) {
//       output =
//         await scrapePunjabKingsNews(
//           sourceUrl,
//           sinceDate
//         );
//     }

//     /*
//      * =====================================================
//      * GENERIC FALLBACK
//      * =====================================================
//      */
//     else {
//       const {
//         html,
//         finalUrl,
//       } =
//         await fetchHtml(
//           sourceUrl
//         );

//       output =
//         extractArticlesGeneric(
//           html,
//           finalUrl,
//           sinceDate,
//           sourceUrl
//         );
//     }

//     console.log(
//       `[News scraper] ${sourceUrl}`,
//       output.diagnostics
//     );

//     return Response.json(
//       output
//     );
//   } catch (error) {
//     console.error(
//       error
//     );

//     return Response.json(
//       {
//         error:
//           error?.message ||
//           "Unexpected error while scraping the listing page.",
//       },
//       {
//         status: 500,
//       }
//     );
//   }
// }

export async function POST(
  request
) {
  try {
    const {
      url: rawUrl,
      sinceDate,
    } =
      await request.json();

    if (!rawUrl) {
      return Response.json(
        {
          error:
            "A source URL is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        sinceDate || ""
      )
    ) {
      return Response.json(
        {
          error:
            "Provide a valid start date.",
        },
        {
          status: 400,
        }
      );
    }

    const sourceUrl =
      validatePublicUrl(
        rawUrl
      ).toString();

    const selectedDate =
      new Date(
        `${sinceDate}T00:00:00.000Z`
      );

    if (
      Number.isNaN(
        selectedDate.getTime()
      )
    ) {
      return Response.json(
        {
          error:
            "Invalid start date.",
        },
        {
          status: 400,
        }
      );
    }

    const today =
      new Date();

    today.setUTCHours(
      23,
      59,
      59,
      999
    );

    if (
      selectedDate >
      today
    ) {
      return Response.json(
        {
          error:
            "The start date cannot be in the future.",
        },
        {
          status: 400,
        }
      );
    }

    let output;

    /*
     * =====================================================
     * SITE-SPECIFIC ADAPTERS
     * =====================================================
     */

    if (
      isCplNewsUrl(
        sourceUrl
      )
    ) {
      output =
        await scrapeCplNews(
          sourceUrl,
          sinceDate
        );
    } else if (
      isSa20NewsUrl(
        sourceUrl
      )
    ) {
      output =
        await scrapeSa20News(
          sourceUrl,
          sinceDate
        );
    } else if (
      isPcaNewsUrl(
        sourceUrl
      )
    ) {
      output =
        await scrapePcaNews(
          sourceUrl,
          sinceDate
        );
    } else if (
      isCskNewsUrl(
        sourceUrl
      )
    ) {
      output =
        await scrapeCskNews(
          sourceUrl,
          sinceDate
        );
    } else if (
      isPunjabKingsNewsUrl(
        sourceUrl
      )
    ) {
      output =
        await scrapePunjabKingsNews(
          sourceUrl,
          sinceDate
        );
    } else if (
      isSunrisersHyderabadNewsUrl(
        sourceUrl
      )
    ) {
      output =
        await scrapeSunrisersHyderabadNews(
          sourceUrl,
          sinceDate
        );
    } else if (
      isBcbMediaReleaseUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeBcbMediaReleases(
        sourceUrl,
        sinceDate
      );
    } else if (
      isPcbPressReleaseUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapePcbPressReleases(
        sourceUrl,
        sinceDate
      );
    } else if (
      isNzcNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeNzcNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isCwiNewsUrl(
        sourceUrl
      )
    ) {
    output =
    await scrapeCwiNews(
      sourceUrl,
      sinceDate
      );
    } else if (
      isZimbabweCricketNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeZimbabweCricketNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isKarachiKingsNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeKarachiKingsNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isLahoreQalandarsNewsUrl(
      sourceUrl
      )
    ) {
    output =
      await scrapeLahoreQalandarsNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isCricketScotlandNewsUrl(
        sourceUrl
      ) 
    ) {
  output =
      await scrapeCricketScotlandNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isKncbNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeKncbNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isDerbyshireNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeDerbyshireNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isDurhamCricketNewsUrl(
       sourceUrl
      )
    ) {
    output =
      await scrapeDurhamCricketNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isGloucestershireNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeGloucestershireNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isHampshireCricketNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeHampshireCricketNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isKentCricketNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeKentCricketNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isMiddlesexNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeMiddlesexNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isNorthamptonshireNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeNorthamptonshireNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isNottinghamshireNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeNottinghamshireNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isSomersetNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeSomersetNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isSussexCricketNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeSussexCricketNews(
        sourceUrl,
        sinceDate
      );
    } else if (
        isWarwickshireNewsUrl(
          sourceUrl
        )
    ) {
    output =
      await scrapeWarwickshireNews(
        sourceUrl,
        sinceDate
      );
    } else if (
        isYorkshireNewsUrl(
          sourceUrl
        )
    ) {
    output =
      await scrapeYorkshireNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isGlamorganNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeGlamorganNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isBcciNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeBcciNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isIccNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapeIccNews(
        sourceUrl,
        sinceDate
      );
    } else if (
        isCricketAustraliaNewsUrl(
          sourceUrl
        )
    ) {
    output =
      await scrapeCricketAustraliaNews(
        sourceUrl,
        sinceDate
      );
    } else if (
      isPerthScorchersNewsUrl(
        sourceUrl
      )
    ) {
    output =
      await scrapePerthScorchersNews(
        sourceUrl,
        sinceDate
      );
    } else if (
        isRcbNewsUrl(
          sourceUrl
        )
    ) {
    output =
      await scrapeRcbNews(
        sourceUrl,
        sinceDate
      );
    }

    /*
     * =====================================================
     * GENERIC FALLBACK
     * =====================================================
     */
    else {
      const {
        html,
        finalUrl,
      } =
        await fetchHtml(
          sourceUrl
        );

      output =
        extractArticlesGeneric(
          html,
          finalUrl,
          sinceDate,
          sourceUrl
        );
    }

    console.log(
      `[News scraper] ${sourceUrl}`,
      output.diagnostics
    );

    return Response.json(
      output
    );
  } catch (error) {
    console.error(
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unexpected error while scraping the listing page.",
      },
      {
        status: 500,
      }
    );
  }
}