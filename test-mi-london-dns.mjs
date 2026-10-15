import https from "node:https";

const HOSTNAME =
  "milondon.co.uk";

const PATH =
  "/wp-json/wp/v2/posts?per_page=3&_fields=id,date,link,title";


/*
 * Resolve MI London through Google's
 * DNS-over-HTTPS instead of your
 * computer's normal DNS.
 */
async function resolveMiLondon() {
  const url =
    `https://dns.google/resolve?name=${HOSTNAME}&type=A`;

  console.log(
    "Resolving through Google DNS..."
  );

  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/dns-json",
        },
      }
    );


  if (!response.ok) {
    throw new Error(
      `DNS-over-HTTPS returned HTTP ${response.status}`
    );
  }


  const data =
    await response.json();


  const addresses =
    (data.Answer || [])
      .filter(
        (item) =>
          item.type === 1
      )
      .map(
        (item) =>
          item.data
      );


  if (!addresses.length) {
    throw new Error(
      "Google DNS returned no IPv4 address for MI London."
    );
  }


  return addresses;
}


function testMiLondonWithIp(
  ip
) {
  return new Promise(
    (resolve) => {
      console.log(
        "\nUsing resolved IP:",
        ip
      );

      console.log(
        "Requesting:",
        `https://${HOSTNAME}${PATH}`
      );


      const request =
        https.request(
          {
            hostname:
              HOSTNAME,

            port:
              443,

            path:
              PATH,

            method:
              "GET",

            /*
             * Important:
             *
             * We keep hostname as
             * milondon.co.uk so HTTPS/SNI
             * still uses the correct domain.
             *
             * We only override DNS lookup.
             */
            lookup:
              (
                hostname,
                options,
                callback
              ) => {
                if (
                  options &&
                  options.all
                ) {
                  callback(
                    null,
                    [
                      {
                        address:
                          ip,

                        family:
                          4,
                      },
                    ]
                  );

                  return;
                }


                callback(
                  null,
                  ip,
                  4
                );
              },

            headers: {
              Host:
                HOSTNAME,

              Accept:
                "application/json",

              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36",

              "Accept-Language":
                "en-GB,en-US;q=0.9,en;q=0.8",

              Referer:
                "https://milondon.co.uk/news/",
            },

            timeout:
              20000,
          },

          (response) => {
            let body =
              "";


            response.on(
              "data",
              (chunk) => {
                body +=
                  chunk.toString();
              }
            );


            response.on(
              "end",
              () => {
                console.log(
                  "\nSTATUS:",
                  response.statusCode
                );

                console.log(
                  "CONTENT TYPE:",
                  response.headers[
                    "content-type"
                  ]
                );

                console.log(
                  "RESPONSE LENGTH:",
                  body.length
                );

                console.log(
                  "\nFIRST 1000 CHARACTERS:\n"
                );

                console.log(
                  body.slice(
                    0,
                    1000
                  )
                );


                resolve({
                  success:
                    response.statusCode >=
                      200 &&
                    response.statusCode <
                      300,

                  status:
                    response.statusCode,
                });
              }
            );
          }
        );


      request.on(
        "timeout",
        () => {
          console.log(
            "\nREQUEST TIMED OUT"
          );

          request.destroy();

          resolve({
            success:
              false,
          });
        }
      );


      request.on(
        "error",
        (error) => {
          console.log(
            "\nREQUEST FAILED"
          );

          console.log(
            "NAME:",
            error.name
          );

          console.log(
            "MESSAGE:",
            error.message
          );

          console.log(
            "CODE:",
            error.code
          );


          resolve({
            success:
              false,
          });
        }
      );


      request.end();
    }
  );
}


async function main() {
  try {
    const addresses =
      await resolveMiLondon();


    console.log(
      "Google DNS returned:",
      addresses
    );


    /*
     * Try every IP returned in case
     * one server is unavailable.
     */
    for (
      const ip of
      addresses
    ) {
      const result =
        await testMiLondonWithIp(
          ip
        );


      if (
        result.success
      ) {
        console.log(
          "\nSUCCESS: MI London works when system DNS is bypassed."
        );

        return;
      }
    }


    console.log(
      "\nDNS resolution worked, but MI London itself could not be reached successfully."
    );
  } catch (
    error
  ) {
    console.log(
      "\nFAILED"
    );

    console.log(
      "MESSAGE:",
      error.message
    );
  }
}


main();