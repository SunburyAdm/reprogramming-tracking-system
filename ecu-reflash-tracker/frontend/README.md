# Frontend Documentation  

React + Vite + TypeScript frontend for ECU Tracking system.

## Project Structure

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── ECUTable.tsx       # Main ECU table display
│   │   ├── ECUTable.css
│   │   ├── ECUDetails.tsx     # Side drawer with details
│   │   ├── ECUDetails.css
│   │   ├── ScanModal.tsx      # QR/barcode scan modal
│   │   └── ScanModal.css
│   ├── pages/
│   │   ├── LoginPage.tsx      # Login form
│   │   └── LoginPage.css
│   ├── services/
│   │   ├── api.ts            # Axios API client
│   │   ├── qr.ts             # QR scanner hook
│   │   └── websocket.ts       # WebSocket hook
│   ├── store/
│   │   └── index.ts          # Zustand stores
│   ├── styles/
│   │   └── global.css        # Global styles
│   ├── App.tsx               # Main app component
│   ├── App.css
│   └── main.tsx              # React entry point
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── Dockerfile
└── .env.example
```

## Installation

```bash
# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local
# Edit VITE_API_URL if needed

# Start development server
npm run dev
```

## Development

```bash
# Hot reload development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint TypeScript
npm run lint
```

## Key Components

### LoginPage
- Email/password authentication
- Stores JWT token in localStorage
- Redirects to dashboard on success

### ECUTable
- Displays list of ECUs with sorting/filtering
- Click to select and view details
- Quick action buttons: Take, Release
- Responsive design

### ECUDetails (Drawer)
- Shows full ECU information
- Displays upload history
- File upload form (dump/log/config)
- Action timeline/audit trail

### ScanModal
- QR/barcode scanner using device camera
- Manual input fallback
- Shows camera feed
- Triggers ECU creation/update on successful scan

## State Management (Zustand)

Three main stores:

1. **AuthStore**
   - `user` - Current user object
   - `token` - JWT token
   - `setAuth()` - Login
   - `logout()` - Logout

2. **ECUStore**
   - `ecus` - Array of ECU objects
   - `selectedECU` - Currently selected ECU
   - `loading` - Loading state
   - `setECUs()`, `updateECU()`, `addECU()` - Updates

3. **FilterStore**
   - `statusFilter` - Filter by status
   - `assigneeFilter` - Filter by assignee
   - `searchQuery` - Search text
   - `setStatusFilter()`, `setAssigneeFilter()`, `setSearchQuery()` - Updates

## API Integration

Axios instance with:
- Automatic Bearer token injection
- 401 error handling (auto-redirect to login)
- Base URL configuration
- Request/response types

## WebSocket Connection

- Real-time updates on `/ws` endpoint
- Auto-reconnect on disconnect
- Broadcasts to all connected clients
- Used for live table updates

## Styling

- Global CSS variables for consistency
- Responsive grid layout
- Mobile-first approach
- Light theme with professional colors

## Building for Production

```bash
npm run build
# Creates optimized dist/ folder for deployment
```

## Environment Variables

```
VITE_API_URL=http://localhost:8000  # Backend API URL
```

## Performance Optimization

- Code splitting with Vite
- Lazy component loading
- Optimized re-renders with Zustand
- Image optimization
- CSS minification
- Tree-shaking unused code

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern ES2020 target
