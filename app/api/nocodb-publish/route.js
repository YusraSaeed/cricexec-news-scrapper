export const runtime = "nodejs";

const NOCODB_BASE_URL =
  "https://cricexec-nocodb-prod.onrender.com";

const NOCODB_TABLE_ID =
  "mt4szna9j73bdao";


function cleanValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}


function normalizeArticle(article) {
  const headline =
    cleanValue(
      article?.headline ||
      article?.title
    );

  const articleUrl =
    cleanValue(
      article?.articleUrl ||
      article?.url ||
      article?.article
    );

  const source =
    cleanValue(
      article?.source ||
      article?.organizationName
    );

  const date =
    cleanValue(
      article?.articleDate ||
      article?.date
    );


  return {
    headline,
    articleUrl,
    source,
    date,
  };
}


/*
 * NocoDB's newer WHERE syntax can also be
 * used with the v2 API by prefixing it with @.
 *
 * We escape quotes/backslashes because URLs
 * can contain special characters.
 */
function quoteNocoValue(value) {
  const escaped =
    String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

  return `"${escaped}"`;
}


async function articleAlreadyExists({
  articleUrl,
  token,
}) {
  const where =
    `@("Article URL(s)",eq,${quoteNocoValue(
      articleUrl
    )})`;


  const url =
    new URL(
      `/api/v2/tables/${NOCODB_TABLE_ID}/records`,
      NOCODB_BASE_URL
    );


  url.searchParams.set(
    "limit",
    "1"
  );

  url.searchParams.set(
    "where",
    where
  );


  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",

        headers: {
          "xc-token":
            token,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  if (!response.ok) {
    const text =
      await response
        .text()
        .catch(() => "");

    throw new Error(
      `NocoDB duplicate check failed (${response.status}): ${text.slice(
        0,
        300
      )}`
    );
  }


  const data =
    await response.json();


  return (
    Array.isArray(data?.list) &&
    data.list.length > 0
  );
}


async function checkDuplicates(
  articles,
  token
) {
  const existing =
    [];

  const newArticles =
    [];


  /*
   * Keep concurrency modest so we don't hammer
   * the NocoDB instance with many simultaneous
   * duplicate checks.
   */
  const concurrency =
    5;


  for (
    let i = 0;
    i < articles.length;
    i += concurrency
  ) {
    const batch =
      articles.slice(
        i,
        i + concurrency
      );


    const batchResults =
      await Promise.all(
        batch.map(
          async (article) => {
            const exists =
              await articleAlreadyExists({
                articleUrl:
                  article.articleUrl,

                token,
              });


            return {
              article,
              exists,
            };
          }
        )
      );


    for (
      const result of
      batchResults
    ) {
      if (
        result.exists
      ) {
        existing.push(
          result.article
        );
      } else {
        newArticles.push(
          result.article
        );
      }
    }
  }


  return {
    existing,
    newArticles,
  };
}


export async function POST(request) {
  try {
    const token =
      process.env
        .NOCODB_API_TOKEN;


    if (!token) {
      return Response.json(
        {
          ok: false,
          error:
            "NOCODB_API_TOKEN is not configured on the server.",
        },
        {
          status: 500,
        }
      );
    }


    const body =
      await request.json();


    const incomingArticles =
      Array.isArray(
        body?.articles
      )
        ? body.articles
        : [];


    if (
      incomingArticles.length ===
      0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "No scraped articles were supplied.",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * Normalize scraper result aliases.
     */
    const normalized =
      incomingArticles
        .map(
          normalizeArticle
        )
        .filter(
          (article) =>
            article.headline &&
            article.articleUrl
        );


    const invalidCount =
      incomingArticles.length -
      normalized.length;


    /*
     * Remove duplicates within the current
     * scrape itself before checking NocoDB.
     */
    const uniqueByUrl =
      new Map();


    for (
      const article of
      normalized
    ) {
      uniqueByUrl.set(
        article.articleUrl,
        article
      );
    }


    const uniqueArticles =
      [
        ...uniqueByUrl.values(),
      ];


    const duplicateInsideScrape =
      normalized.length -
      uniqueArticles.length;


    /*
     * Check whether Article URL(s)
     * already exists in NocoDB.
     */
    const {
      existing,
      newArticles,
    } =
      await checkDuplicates(
        uniqueArticles,
        token
      );


    /*
     * Nothing new to insert.
     */
    if (
      newArticles.length ===
      0
    ) {
      return Response.json({
        ok: true,

        inserted:
          0,

        skippedExisting:
          existing.length,

        duplicateInsideScrape,

        invalid:
          invalidCount,

        message:
          "No new articles were added because all scraped URLs already exist in NocoDB.",
      });
    }


    /*
     * Convert scraper fields to exact
     * NocoDB field names.
     */
    const records =
      newArticles.map(
        (article) => ({
          "Basic Story":
            article.headline,

          "Article URL(s)":
            `[${article.articleUrl}](${article.articleUrl})`,

          "Source":
            article.source,

          "Actual Date of Original Article/Release":
            article.date,
        })
      );


    const endpoint =
      `${NOCODB_BASE_URL}` +
      `/api/v2/tables/${NOCODB_TABLE_ID}/records`;


    /*
     * NocoDB v2 accepts an array of records,
     * so all new articles can be inserted
     * in one request.
     */
    const response =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "xc-token":
              token,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify(
              records
            ),

          cache:
            "no-store",
        }
      );


    if (!response.ok) {
      const text =
        await response
          .text()
          .catch(() => "");


      console.error(
        "[NOCODB PUBLISH ERROR]",
        {
          status:
            response.status,

          response:
            text,
        }
      );


      return Response.json(
        {
          ok: false,

          error:
            `NocoDB returned HTTP ${response.status}.`,

          details:
            text.slice(
              0,
              500
            ),
        },
        {
          status: 502,
        }
      );
    }


    const created =
      await response
        .json()
        .catch(
          () => null
        );


    return Response.json({
      ok: true,

      inserted:
        newArticles.length,

      skippedExisting:
        existing.length,

      duplicateInsideScrape,

      invalid:
        invalidCount,

      created,

      message:
        `${newArticles.length} article(s) added to NocoDB.`,
    });
  } catch (error) {
    console.error(
      "[NOCODB PUBLISH ERROR]",
      error
    );


    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Unexpected NocoDB publishing error.",
      },
      {
        status: 500,
      }
    );
  }
}