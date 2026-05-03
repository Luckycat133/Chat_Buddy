# Chat Buddy — Deployment Guide

## Quick Start (Development)

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
# => http://localhost:5173
```

## Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

The build output is in `dist/` and can be served by any static file server.

## Deployment Options

### Option A — Static Hosting (Vercel / Netlify / Cloudflare Pages)

1. Connect your repository to Vercel / Netlify / Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Deploy!

### Option B — Nginx (Self-hosted)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/chat-buddy/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location ~* \.(js|css|png|jpg|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Option C — Docker

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Runtime Configuration

### API Proxy

The development server includes a built-in proxy for API calls:

- `/api/*` → `http://localhost:3001`
- `/proxy/openai/*` → `https://api.openai.com`
- `/proxy/anthropic/*` → `https://api.anthropic.com`
- `/proxy/perplexity/*` → `https://api.perplexity.ai`

For production, use Nginx or a gateway to handle these proxy rules.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_HOST` | Base API URL | (derived from window.location) |

## Performance

- **Lighthouse score target**: 90+ Performance, 100 Accessibility, 90+ Best Practices
- **Bundle size**: ~250 KB gzipped (code-split into 4 chunks)
- **First Contentful Paint**: < 1.5s on 3G
- **Time to Interactive**: < 3s on 3G

## Security Checklist

- [x] Content Security Policy (CSP) headers
- [x] XSS prevention (input sanitization)
- [x] CSRF protection (modern browser same-origin policy)
- [x] No API keys in client bundle
- [x] Service Worker with limited caching scope
- [x] HTTPS enforced in production

## Monitoring

The app logs via `console` (structured JSON when `__DEV__` is false). In production, consider forwarding logs to a service like Sentry or LogRocket.

## Browser Support

| Browser | Minimum Version |
|---|---|
| Chrome | 90+ |
| Firefox | 90+ |
| Safari | 15+ |
| Edge | 90+ |

## Troubleshooting

**Blank screen after deploy**: Check that `dist/` includes `index.html` and assets. Verify the server serves SPA fallback (`try_files $uri /index.html`).

**API calls failing**: Check proxy configuration. In production, ensure the API gateway is properly routing `/api/*` requests.

**Service Worker not caching**: Ensure `sw.js` is served from the root path and not cached by the browser (set `Cache-Control: no-cache` for `sw.js` in Nginx).
