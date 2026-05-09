const CLOUDFLARE_BASE = "https://speed.cloudflare.com";
const DOWNLOAD_BYTES = 100_000_000;
const UPLOAD_CHUNK_BYTES = 256_000;
const MIN_PHASE_MS = 15_000;
const LATENCY_ROUNDS = 12;
const STREAM_COUNT = 4;
const UPLOAD_STREAM_COUNT = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const emptyResults = {
  ping: 0,
  jitter: 0,
  downloadMbps: 0,
  uploadMbps: 0,
  downloadSamples: [],
  uploadSamples: [],
  stabilityScore: 0,
  ipInfo: {}
};

export function mbpsToMBps(mbps) {
  // Network providers advertise megabits per second. File transfers are usually
  // shown in megabytes per second, so the practical speed is Mbps divided by 8.
  return mbps / 8;
}

export function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(digits);
}

export function secondsToReadable(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Not available";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function estimateDownloadTime(gigabytes, mbps) {
  return estimateTransferTime(gigabytes * 1024, mbps);
}

export function estimateTransferTime(megabytes, mbps) {
  const usableMBps = mbpsToMBps(mbps);
  return secondsToReadable(megabytes / usableMBps);
}

export function calculateJitter(latencies) {
  if (latencies.length < 2) return 0;
  const deltas = [];
  for (let index = 1; index < latencies.length; index += 1) {
    deltas.push(Math.abs(latencies[index] - latencies[index - 1]));
  }
  return deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
}

export function calculateStability(samples) {
  if (samples.length < 4) return 0;
  const speeds = samples.map((sample) => sample.mbps).filter((value) => value > 0);
  const average = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;
  const variance = speeds.reduce((sum, value) => sum + (value - average) ** 2, 0) / speeds.length;
  const coefficient = Math.sqrt(variance) / average;
  return Math.max(0, Math.min(100, 100 - coefficient * 120));
}

export function qualityLabels({ downloadMbps, uploadMbps, ping, jitter }) {
  const gamingGood = ping <= 35 && jitter <= 12;
  const gamingAverage = ping <= 75 && jitter <= 25;
  const streamingGood = downloadMbps >= 35;
  const streamingAverage = downloadMbps >= 15;
  const uploadsGood = uploadMbps >= 20;
  const uploadsAverage = uploadMbps >= 5;

  return {
    gaming: gamingGood ? "Good" : gamingAverage ? "Average" : "Poor",
    streaming: streamingGood ? "Good" : streamingAverage ? "Average" : "Poor",
    uploads: uploadsGood ? "Good" : uploadsAverage ? "Average" : "Poor",
    fourK: downloadMbps >= 25 ? "Ready" : downloadMbps >= 15 ? "Marginal" : "Not ready",
    videoCall: uploadMbps >= 5 && downloadMbps >= 5 && ping <= 75 ? "Good" : uploadMbps >= 2 ? "Average" : "Poor"
  };
}

async function measureLatency(onProgress, signal) {
  const latencies = [];
  let ipInfo = {};
  for (let index = 0; index < LATENCY_ROUNDS; index += 1) {
    if (signal.aborted) break;
    const start = performance.now();
    const response = await fetch(`${CLOUDFLARE_BASE}/__down?bytes=1&cacheBust=${Date.now()}-${index}`, {
      cache: "no-store",
      mode: "cors",
      signal
    });
    if (!response.ok) throw new Error("Latency endpoint rejected the browser request.");
    const latency = performance.now() - start;
    ipInfo = { ...ipInfo, ...readIpInfo(response) };
    latencies.push(latency);
    onProgress({ phase: "ping", ping: average(latencies), jitter: calculateJitter(latencies), ipInfo });
    await sleep(180);
  }
  const enrichedIpInfo = await fetchIpInfo(ipInfo, signal);
  onProgress({ phase: "ping", ping: average(latencies), jitter: calculateJitter(latencies), ipInfo: enrichedIpInfo });
  return {
    ping: average(latencies),
    jitter: calculateJitter(latencies),
    ipInfo: enrichedIpInfo
  };
}

async function downloadWorker(signal, bytesRead) {
  while (!signal.aborted) {
    const response = await fetch(`${CLOUDFLARE_BASE}/__down?bytes=${DOWNLOAD_BYTES}&cacheBust=${Math.random()}`, {
      cache: "no-store",
      mode: "cors",
      signal
    });
    if (!response.ok) throw new Error("Download endpoint rejected the browser request.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Streaming downloads are not supported in this browser.");

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead.count += value.byteLength;
    }
  }
}

async function measureDownload(onProgress, externalSignal) {
  const controller = new AbortController();
  externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  const bytesRead = { count: 0 };
  const errors = [];
  const workers = Array.from({ length: STREAM_COUNT }, () =>
    downloadWorker(controller.signal, bytesRead).catch((error) => {
      if (!controller.signal.aborted) errors.push(error);
    })
  );
  const samples = [];
  let lastBytes = 0;
  let elapsedSeconds = 0;

  const sampler = setInterval(() => {
    elapsedSeconds += 1;
    const deltaBytes = bytesRead.count - lastBytes;
    lastBytes = bytesRead.count;
    const mbps = (deltaBytes * 8) / 1_000_000;
    samples.push({ second: elapsedSeconds, mbps });
    onProgress({ phase: "download", downloadMbps: sustainedAverage(samples), downloadSamples: samples });
  }, 1000);

  await sleep(MIN_PHASE_MS);
  controller.abort();
  clearInterval(sampler);
  await Promise.allSettled(workers);
  if (bytesRead.count === 0 && errors.length > 0) throw errors[0];
  return {
    downloadMbps: sustainedAverage(samples),
    downloadSamples: samples
  };
}

async function uploadWorker(signal, bytesSent) {
  const payload = new Blob([new Uint8Array(UPLOAD_CHUNK_BYTES)]);
  while (!signal.aborted) {
    const response = await fetch(`${CLOUDFLARE_BASE}/__up?bytes=${UPLOAD_CHUNK_BYTES}&cacheBust=${Math.random()}`, {
      method: "POST",
      body: payload,
      cache: "no-store",
      mode: "cors",
      signal
    });
    if (!response.ok) throw new Error("Upload endpoint rejected the browser request.");
    bytesSent.count += UPLOAD_CHUNK_BYTES;
  }
}

async function measureUpload(onProgress, externalSignal) {
  const controller = new AbortController();
  externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  const bytesSent = { count: 0 };
  const errors = [];
  const workers = Array.from({ length: UPLOAD_STREAM_COUNT }, () =>
    uploadWorker(controller.signal, bytesSent).catch((error) => {
      if (!controller.signal.aborted) errors.push(error);
    })
  );
  const samples = [];
  let lastBytes = 0;
  let elapsedSeconds = 0;

  const sampler = setInterval(() => {
    elapsedSeconds += 1;
    const deltaBytes = bytesSent.count - lastBytes;
    lastBytes = bytesSent.count;
    const mbps = (deltaBytes * 8) / 1_000_000;
    samples.push({ second: elapsedSeconds, mbps });
    onProgress({ phase: "upload", uploadMbps: sustainedAverage(samples), uploadSamples: samples });
  }, 1000);

  await sleep(MIN_PHASE_MS);
  controller.abort();
  clearInterval(sampler);
  await Promise.allSettled(workers);
  if (bytesSent.count === 0 && errors.length > 0) throw errors[0];
  return {
    uploadMbps: sustainedAverage(samples),
    uploadSamples: samples
  };
}

function sustainedAverage(samples) {
  const usable = samples.slice(2).filter((sample) => sample.mbps > 0);
  if (usable.length === 0) return 0;
  return usable.reduce((sum, sample) => sum + sample.mbps, 0) / usable.length;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function readIpInfo(response) {
  return {
    ip: response.headers.get("cf-meta-ip") || "",
    city: response.headers.get("cf-meta-city") || "",
    country: response.headers.get("cf-meta-country") || "",
    colo: response.headers.get("cf-meta-colo") || "",
    asn: response.headers.get("cf-meta-asn") || "",
    timezone: response.headers.get("cf-meta-timezone") || ""
  };
}

async function fetchIpInfo(fallback, signal) {
  try {
    const response = await fetch("https://ipwho.is/", {
      cache: "no-store",
      signal
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    if (data.success === false) return fallback;
    return {
      ip: data.ip || fallback.ip || "",
      city: data.city || fallback.city || "",
      country: data.country_code || data.country || fallback.country || "",
      colo: fallback.colo || "",
      asn: data.connection?.asn ? String(data.connection.asn) : fallback.asn || "",
      isp: data.connection?.isp || data.connection?.org || "",
      timezone: data.timezone?.id || fallback.timezone || ""
    };
  } catch (_error) {
    return fallback;
  }
}

export async function runSpeedTest(onProgress, signal) {
  const latency = await measureLatency(onProgress, signal);
  const download = await measureDownload(onProgress, signal);
  const upload = await measureUpload(onProgress, signal);
  const stabilityScore = calculateStability([...download.downloadSamples, ...upload.uploadSamples]);
  const results = {
    ...latency,
    ...download,
    ...upload,
    stabilityScore
  };
  onProgress({ phase: "complete", ...results });
  return results;
}
