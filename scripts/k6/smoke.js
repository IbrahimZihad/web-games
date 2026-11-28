import http from "k6/http";
import { check } from "k6";

const baseUrl = (__ENV.K6_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const gameSlug = __ENV.K6_GAME_SLUG || "cyber-runner";

export const options = {
  vus: 1,
  duration: __ENV.K6_DURATION || "10s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

export default function smoke() {
  const responses = http.batch([
    ["GET", `${baseUrl}/`, null, { tags: { route: "home" } }],
    ["GET", `${baseUrl}/games`, null, { tags: { route: "catalog" } }],
    ["GET", `${baseUrl}/games/${gameSlug}`, null, { tags: { route: "game" } }],
    ["POST", `${baseUrl}/api/graphql`, JSON.stringify({
      query: `query Smoke($slug: String!) { gameBySlug(slug: $slug) { id title slug playCount } }`,
      variables: { slug: gameSlug },
    }), {
      headers: { "Content-Type": "application/json" },
      tags: { route: "graphql" },
    }],
  ]);

  responses.forEach((response, index) => {
    check(response, {
      [`smoke endpoint ${index} returns 200`]: (result) => result.status === 200,
    });
  });
}
