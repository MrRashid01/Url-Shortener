import client from "prom-client";
import { clickQueueLength } from "./clickQueue";

client.collectDefaultMetrics(); // CPU, memory, event loop delay

export const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "How long requests take",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

export const redirects = new client.Counter({
  name: "redirects_total",
  help: "Short link visits by result and cache source",
  labelNames: ["result", "cache"],
});

new client.Gauge({
  name: "click_queue_length",
  help: "Clicks waiting to be saved",
  async collect() {
    try {
      this.set(await clickQueueLength());
    } catch {
      /* Redis down: keep the old value */
    }
  },
});

export const metricsText = () => client.register.metrics();
export const metricsContentType = client.register.contentType;