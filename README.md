# Real Internet Speed

Real Internet Speed is a static, frontend-only web app that measures internet performance in the browser and explains it in practical terms. It shows both the technical bandwidth value in Mbps and the usable download value in MB/s.

Core conversion:

```txt
Usable MB/s = Mbps / 8
```

Example: `100 Mbps / 8 = 12.5 MB/s`.

## Features

- Real browser-based ping, jitter, download, and upload tests.
- Sustained 15-second download and upload phases.
- Mbps and MB/s shown side by side.
- Stability score based on transfer fluctuation.
- Real-world estimates for 1 GB, 10 GB, and 50 GB downloads.
- Upload estimates for video and creator project transfers.
- IP, approximate location, ASN, timezone, and Cloudflare edge information.
- Gaming, streaming, upload, 4K, and video call quality labels.
- Dark responsive UI with an animated gauge and live graph.
- No backend, database, VPS, or always-running server.

## Architecture

This is a Vite + React + TailwindCSS static app. Browser `fetch` requests measure real transfer timing against Cloudflare speed-test endpoints:

- Download: `https://speed.cloudflare.com/__down`
- Upload: `https://speed.cloudflare.com/__up`
- Latency: tiny `https://speed.cloudflare.com/__down?bytes=1` requests

The app can deploy to Cloudflare Pages, Vercel, Netlify, or GitHub Pages.

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the static site:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Run lint checks:

```bash
npm run lint
```

## Cloudflare Pages Deployment

1. Push this repository to GitHub or GitLab.
2. Open Cloudflare Dashboard, then go to **Workers & Pages**.
3. Choose **Create application** and select **Pages**.
4. Connect the repository.
5. Set the framework preset to **Vite**.
6. Use `npm run build` as the build command.
7. Use `dist` as the output directory.
8. Deploy.

No Cloudflare Worker is required for the current implementation.

## Other Static Hosts

- Vercel: import the repo, keep the Vite defaults, and deploy.
- Netlify: build with `npm run build`, publish `dist`.
- GitHub Pages: build `dist` and publish it with your preferred Pages workflow.

## Accuracy Notes

Results are estimates from the browser and depend on route, endpoint, and device conditions. Actual downloads depend on server speed. Wi-Fi quality, VPNs, CPU load, browser throttling, and network congestion can affect results. MB/s values are estimated usable speeds derived from Mbps.
