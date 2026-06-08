# Remotely 🌐

A clean, simple, and secure sandboxed browser virtualization application. It allows you to run a sandboxed browser instance in a Docker container and interact with it in real-time via a Next.js web interface.


## 📺 Demo

[![remotely Demo](https://img.shields.io/badge/YouTube-Play%20Demo-red?style=for-the-badge&logo=youtube)](https://www.youtube.com/watch?v=KPSqT0YZPws)



## 🚀 How to Setup

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed and running.
- [Node.js](https://nodejs.org/) (v18 or higher) and `npm` installed.

---

### Option A: Automatic Setup (Recommended)

Run the automatic setup script to verify prerequisites, build the Docker container, and install all dependencies in one command:

```bash
./setup.sh
```

---

### Option B: Manual Setup

#### 1. Build the Browser Worker (Docker)
The browser worker runs inside a Docker container using Playwright to launch a headless Chromium instance.

```bash
docker build -t bld-browser ./backend
```

#### 2. Start the Backend Orchestrator
The host orchestrator manages the Docker container, proxies browser actions, and streams the viewport.

```bash
cd backend
npm install
node server.js
```
*The orchestrator will run on `http://localhost:4000`.*

#### 3. Start the Frontend Application
The Next.js frontend connects to the orchestrator via WebSockets to stream frames and forward keyboard/mouse interactions.

```bash
cd frontend
npm install
npm run dev
```
*The frontend will run on `http://localhost:3000`.*

---

### 4. Use the Application
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Click **Start Remote Browser** to launch the Docker container.
3. Interact with the sandboxed browser screen directly using your mouse and keyboard.

