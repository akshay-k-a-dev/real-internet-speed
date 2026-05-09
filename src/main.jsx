import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  emptyResults,
  estimateDownloadTime,
  estimateTransferTime,
  formatNumber,
  mbpsToMBps,
  qualityLabels,
  runSpeedTest
} from "./lib/speedTest";
import "./styles.css";

const phaseText = {
  idle: "Ready",
  starting: "Arming endpoints",
  ping: "Measuring latency",
  download: "Sustained download",
  upload: "Sustained upload",
  complete: "Complete"
};

function App() {
  const [phase, setPhase] = useState("idle");
  const [results, setResults] = useState(emptyResults);
  const [error, setError] = useState("");
  const controllerRef = useRef(null);

  const labels = useMemo(() => qualityLabels(results), [results]);
  const activeMbps = phase === "upload" ? results.uploadMbps : results.downloadMbps;
  const activeSamples = phase === "upload" ? results.uploadSamples : results.downloadSamples;
  const usableDownload = mbpsToMBps(results.downloadMbps);
  const usableUpload = mbpsToMBps(results.uploadMbps);
  const isRunning = !["idle", "complete"].includes(phase);

  async function startTest() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError("");
    setResults(emptyResults);
    setPhase("starting");

    try {
      await runSpeedTest((update) => {
        setPhase(update.phase);
        setResults((current) => ({ ...current, ...update }));
      }, controller.signal);
    } catch (testError) {
      if (controller.signal.aborted) {
        setPhase("idle");
        return;
      }
      setError(testError.message || "The browser could not complete the real speed test.");
      setPhase("idle");
    }
  }

  function stopTest() {
    controllerRef.current?.abort();
    setResults(emptyResults);
    setError("");
    setPhase("idle");
  }

  return (
    <main className="app-shell">
      <div className="grid-overlay" />
      <section className="console">
        <header className="masthead">
          <div>
            <p className="eyebrow">Real Internet Speed</p>
            <h1>See the speed your downloads actually feel.</h1>
          </div>
          <div className="actions">
            <button className="primary-action" disabled={isRunning} onClick={startTest}>
              {isRunning ? "Testing" : "Start real test"}
            </button>
            <button className="secondary-action" onClick={stopTest}>Stop</button>
          </div>
        </header>

        <section className="hero-console">
          <div className="instrument">
            <SpeedGauge mbps={activeMbps} phase={phase} isRunning={isRunning} />
            <LiveGraph samples={activeSamples} />
          </div>

          <div className="readout">
            <p className="readout-label">Usable download speed</p>
            <div className="mega-value">
              <span>{formatNumber(usableDownload, 1)}</span>
              <strong>MB/s</strong>
            </div>
            <div className="conversion-strip">
              <span>{formatNumber(results.downloadMbps, 1)} Mbps</span>
              <span>÷ 8</span>
              <span>{formatNumber(usableDownload, 1)} MB/s</span>
            </div>
            <div className="dual-usable">
              <span>Download usable <strong>{formatNumber(usableDownload, 1)} MB/s</strong></span>
              <span>Upload usable <strong>{formatNumber(usableUpload, 1)} MB/s</strong></span>
            </div>
            <p className="readout-copy">
              Mbps stays visible for technical accuracy. MB/s is emphasized because browsers, game launchers,
              and file downloads usually speak in megabytes.
            </p>
            <Status phase={phase} error={error} />
          </div>
        </section>

        <section className="data-grid">
          <Metric label="Download" value={results.downloadMbps} unit="Mbps" accent />
          <Metric label="Upload" value={results.uploadMbps} unit="Mbps" />
          <Metric label="Upload usable" value={usableUpload} unit="MB/s" />
          <Metric label="Ping" value={results.ping} unit="ms" digits={0} />
          <Metric label="Jitter" value={results.jitter} unit="ms" />
          <Metric label="Stability" value={results.stabilityScore} unit="%" digits={0} />
        </section>

        <section className="lower-grid">
          <EstimatorPanel downloadMbps={results.downloadMbps} labels={labels} />
          <UploadEstimatorPanel uploadMbps={results.uploadMbps} />
          <QualityPanel labels={labels} results={results} />
          <IpPanel ipInfo={results.ipInfo} />
          <EducationPanel />
        </section>
      </section>
    </main>
  );
}

function SpeedGauge({ mbps, phase, isRunning }) {
  const maxSpeed = 100;
  const startAngle = -132;
  const sweepAngle = 264;
  const capped = Math.min(Math.max(mbps, 0), maxSpeed);
  const rotation = speedToAngle(capped, startAngle, sweepAngle);
  const needleRotation = rotation - 90;
  const labels = [
    { value: 0, label: "0" },
    { value: 10, label: "10" },
    { value: 25, label: "25" },
    { value: 50, label: "50" },
    { value: 100, label: "100+" }
  ];
  const minorTicks = Array.from({ length: 21 }, (_, index) => index * 5);

  return (
    <div className={isRunning ? "gauge-shell gauge-active" : "gauge-shell"} style={{ "--needle": `${needleRotation}deg` }}>
      <div className="speedometer-bezel">
        <svg className="speedometer-svg" viewBox="0 0 400 400" role="img" aria-label={`${phase} speedometer`}>
          <defs>
            <linearGradient id="dialGlow" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#c9ff63" />
              <stop offset="58%" stopColor="#38f8ff" />
              <stop offset="100%" stopColor="#ff5b6e" />
            </linearGradient>
          </defs>
          <path className="dial-track" d={arcPath(200, 200, 150, startAngle, startAngle + sweepAngle)} />
          <path className="dial-progress" d={arcPath(200, 200, 150, startAngle, rotation)} />
          <path className="redline" d={arcPath(200, 200, 162, 98, 132)} />
          {minorTicks.map((value) => {
            const angle = speedToAngle(value, startAngle, sweepAngle);
            const major = labels.some((tick) => tick.value === value);
            const outer = polarPoint(200, 200, major ? 159 : 154, angle);
            const inner = polarPoint(200, 200, major ? 132 : 140, angle);
            return (
              <line
                className={major ? "tick tick-major" : "tick tick-minor"}
                key={value}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
              />
            );
          })}
          {labels.map(({ value, label }) => {
            const angle = speedToAngle(value, startAngle, sweepAngle);
            const point = polarPoint(200, 200, 106, angle);
            return (
              <text className="dial-number" key={label} x={point.x} y={point.y} textAnchor="middle" dominantBaseline="middle">
                {label}
              </text>
            );
          })}
          <text className="dial-unit" x="200" y="302" textAnchor="middle">Mbps</text>
        </svg>
        <div className="needle" />
        <div className="needle-tail" />
        <div className="hub"><span /></div>
      </div>
      <div className="gauge-copy">
        <span>{phase === "upload" ? "Upload" : "Download"}</span>
        <strong>{formatNumber(mbps, mbps < 10 ? 1 : 0)}</strong>
        <em>Mbps live</em>
      </div>
    </div>
  );
}

function speedToAngle(speed, startAngle, sweepAngle) {
  const breakpoints = [
    [0, 0],
    [10, 0.28],
    [25, 0.48],
    [50, 0.7],
    [100, 1]
  ];

  for (let index = 1; index < breakpoints.length; index += 1) {
    const [speedEnd, positionEnd] = breakpoints[index];
    const [speedStart, positionStart] = breakpoints[index - 1];
    if (speed <= speedEnd) {
      const segmentProgress = (speed - speedStart) / (speedEnd - speedStart);
      const position = positionStart + segmentProgress * (positionEnd - positionStart);
      return startAngle + position * sweepAngle;
    }
  }

  return startAngle + sweepAngle;
}

function polarPoint(cx, cy, radius, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad)
  };
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweep = endAngle >= startAngle ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

function LiveGraph({ samples }) {
  const points = samples.slice(-30);
  const max = Math.max(20, ...points.map((point) => point.mbps));
  const line = points
    .map((point, index) => {
      const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 96 - (point.mbps / max) * 84;
      return `${x},${y}`;
    })
    .join(" ");
  const area = line ? `0,100 ${line} 100,100` : "";

  return (
    <div className="graph-panel">
      <div className="panel-title">
        <span>Live graph</span>
        <em>sustained averages, not burst peaks</em>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Live internet speed graph">
        <polygon points={area} />
        <polyline points={line || "0,96"} />
      </svg>
    </div>
  );
}

function Metric({ label, value, unit, digits = 1, accent = false }) {
  return (
    <article className={accent ? "metric metric-accent" : "metric"}>
      <span>{label}</span>
      <strong>{formatNumber(value, digits)}</strong>
      <em>{unit}</em>
    </article>
  );
}

function Status({ phase, error }) {
  return (
    <div className={error ? "status status-error" : "status"}>
      <span>{error ? "Blocked" : phaseText[phase]}</span>
      <p>
        {error ||
          (phase === "idle"
            ? "Runs a real browser transfer test against public CORS-enabled speed endpoints."
            : "Download and upload phases run for at least 15 seconds for steadier numbers.")}
      </p>
    </div>
  );
}

function EstimatorPanel({ downloadMbps, labels }) {
  const rows = [
    ["1 GB file", estimateDownloadTime(1, downloadMbps)],
    ["10 GB file", estimateDownloadTime(10, downloadMbps)],
    ["50 GB game", estimateDownloadTime(50, downloadMbps)]
  ];

  return (
    <section className="panel estimator">
      <div className="panel-title">
        <span>Real-world time</span>
        <em>based on current download Mbps ÷ 8</em>
      </div>
      {rows.map(([label, value]) => (
        <div className="estimate-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <div className="capability">
        <span>4K streaming</span>
        <strong>{labels.fourK}</strong>
      </div>
    </section>
  );
}

function UploadEstimatorPanel({ uploadMbps }) {
  const rows = [
    ["100 MB phone video", estimateTransferTime(100, uploadMbps)],
    ["700 MB HD video", estimateTransferTime(700, uploadMbps)],
    ["2 GB 4K clip", estimateTransferTime(2048, uploadMbps)],
    ["10 GB creator project", estimateTransferTime(10240, uploadMbps)]
  ];

  return (
    <section className="panel estimator upload-estimator">
      <div className="panel-title">
        <span>Upload task time</span>
        <em>based on upload Mbps ÷ 8</em>
      </div>
      {rows.map(([label, value]) => (
        <div className="estimate-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

function QualityPanel({ labels, results }) {
  return (
    <section className="panel quality">
      <div className="panel-title">
        <span>Human labels</span>
        <em>practical use, not marketing speed</em>
      </div>
      <QualityRow label="Gaming" value={labels.gaming} detail={`${formatNumber(results.ping, 0)} ms ping`} />
      <QualityRow label="Streaming" value={labels.streaming} detail={`4K: ${labels.fourK}`} />
      <QualityRow label="Uploads" value={labels.uploads} detail={`${formatNumber(mbpsToMBps(results.uploadMbps), 1)} MB/s usable`} />
      <QualityRow label="Video calls" value={labels.videoCall} detail={`${formatNumber(results.jitter, 1)} ms jitter`} />
    </section>
  );
}

function QualityRow({ label, value, detail }) {
  return (
    <div className="quality-row">
      <span>{label}</span>
      <strong data-rating={value}>{value}</strong>
      <em>{detail}</em>
    </div>
  );
}

function IpPanel({ ipInfo = {} }) {
  const rows = [
    ["IP address", ipInfo.ip || "Waiting for test"],
    ["Location", [ipInfo.city, ipInfo.country].filter(Boolean).join(", ") || "Waiting for test"],
    ["ISP", ipInfo.isp || "Waiting for test"],
    ["Cloudflare edge", ipInfo.colo || "Waiting for test"],
    ["ASN", ipInfo.asn || "Waiting for test"],
    ["Timezone", ipInfo.timezone || "Waiting for test"]
  ];

  return (
    <section className="panel ip-panel">
      <div className="panel-title">
        <span>Network identity</span>
        <em>reported by test edge</em>
      </div>
      {rows.map(([label, value]) => (
        <div className="ip-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

function EducationPanel() {
  return (
    <section className="panel education">
      <div className="panel-title">
        <span>Why both units matter</span>
        <em>bits advertise, bytes download</em>
      </div>
      <p>
        Mbps means megabits per second. MB/s means megabytes per second. ISPs advertise Mbps,
        but downloads usually show MB/s. One Byte equals 8 bits, so usable MB/s = Mbps / 8.
      </p>
      <p className="fine-print">
        Actual downloads depend on server speed. Wi-Fi quality affects results. Real-world speeds vary.
        MB/s values are estimated usable speeds.
      </p>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
