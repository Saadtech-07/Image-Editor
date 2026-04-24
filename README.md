# PixelForge AI Image Editor

Full-stack AI image editor built with React, Vite, Tailwind CSS, Fabric.js, Node, Express, Multer, and remove.bg.

## Setup

Install dependencies in both apps:

```bash
cd backend
npm install
cd ../frontend
npm install
```

Create backend environment config:

```bash
cd backend
cp .env.example .env
```

Set `REMOVE_BG_API_KEY` in `backend/.env`.

## Run

Start the API:

```bash
cd backend
npm run dev
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## Flow

Upload image -> remove background -> open editor -> crop/add text/add shapes/manage layers -> export PNG.
