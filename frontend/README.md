# Frontend - AI Chat Platform

Next.js 14 application providing the user interface for the AI Chat Platform.

## Project Structure

```
frontend/
├── app/
│   ├── login/           # Auth pages
│   ├── workspaces/      # Main app logic
│   │   ├── [id]/chat/   # Chat Interface
│   │   └── page.tsx     # Workspace Dashboard
│   └── components/      # (Shared UI components)
├── lib/
│   └── api.ts           # Fetch wrapper & Auth utilities
└── public/              # Static assets
```

## 🛠 Commands

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
Runs on `http://localhost:3000`.

### Build for Production
```bash
npm run build
npm start
```
