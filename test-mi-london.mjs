const endpoints = [
  "https://milondon.co.uk/news/",
  "https://milondon.co.uk/wp-json/wp/v2/posts?per_page=3&_fields=id,date,link,title",
  "https://milondon.co.uk/feed/",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/141.0.0.0 Safari/537.36";

async function testUrl(url) {
  console.log("\n========================================");
  console.log("Testing:");
  console.log(url);
  console.log("========================================");

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    20000
  );

  try {
    const response = await fetch(url, {
      method: "GET",

      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/json,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
      },

      redirect: "follow",

      signal: controller.signal,
    });

    console.log("STATUS:", response.status);
    console.log("OK:", response.ok);
    console.log("FINAL URL:", response.url);

    console.log(
      "CONTENT TYPE:",
      response.headers.get("content-type")
    );

    const text = await response.text();

    console.log(
      "RESPONSE LENGTH:",
      text.length
    );

    console.log(
      "\nFIRST 500 CHARACTERS:\n"
    );

    console.log(
      text.slice(0, 500)
    );
  } catch (error) {
    console.log("\nFAILED");

    console.log(
      "NAME:",
      error?.name
    );

    console.log(
      "MESSAGE:",
      error?.message
    );

    console.log(
      "CAUSE:",
      error?.cause
    );

    if (error?.cause) {
      console.log(
        "CAUSE CODE:",
        error.cause?.code
      );

      console.log(
        "CAUSE MESSAGE:",
        error.cause?.message
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  for (const url of endpoints) {
    await testUrl(url);
  }
}

main();