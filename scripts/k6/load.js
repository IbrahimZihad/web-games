import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = (__ENV.K6_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const gameId = __ENV.K6_GAME_ID || "1";
const gameSlug = __ENV.K6_GAME_SLUG || "cyber-runner";
const targetVus = Number(__ENV.K6_TARGET_VUS || 10000);
const rampUp = __ENV.K6_RAMP_UP || "2m";
const holdDuration = __ENV.K6_HOLD_DURATION || "5m";
const rampDown = __ENV.K6_RAMP_DOWN || "1m";

export const options = {
  discardResponseBodies: true,
  scenarios: {
    players: {
      executor: "ramping-vus",
      startVus: 1,
      stages: [
        { duration: rampUp, target: targetVus },
        { duration: holdDuration, target: targetVus },
        { duration: rampDown, target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    "http_req_duration{route:game}": ["p(95)<800"],
    "http_req_duration{route:graphql}": ["p(95)<800"],
    "http_req_duration{route:play}": ["p(95)<1000"],
  },
};

function graphql(query, variables, route, userAgent) {
  return http.post(`${baseUrl}/api/graphql`, JSON.stringify({ query, variables }), {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    tags: { route },
  });
}

export default function playerSession() {
  const userAgent = `nexus-k6-${__VU}-${__ITER}`;
  const page = http.get(`${baseUrl}/games/${gameSlug}`, {
    headers: { "User-Agent": userAgent },
    tags: { route: "game" },
  });
  check(page, { "game page available": (response) => response.status === 200 });

  const catalog = graphql(
    "query Catalog { games(limit: 24) { id title slug playCount } }",
    {},
    "graphql",
    userAgent,
  );
  check(catalog, { "catalog query available": (response) => response.status === 200 });

  const play = graphql(
    "mutation Play($gameId: ID!) { recordPlay(gameId: $gameId) }",
    { gameId },
    "play",
    userAgent,
  );
  check(play, { "play request accepted": (response) => response.status === 200 });

  sleep(5 + Math.random() * 10);
}
