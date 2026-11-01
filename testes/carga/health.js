import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: { http_req_duration: ["p(95)<1000"] },
};

export default function () {
  const base = __ENV.BASE_URL || "http://localhost:3000";
  const res = http.get(`${base}/healthz`);
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1);
}