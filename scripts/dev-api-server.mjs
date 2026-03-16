import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
const port = Number.parseInt(process.env.LOCAL_API_PORT || '3000', 10);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

function withHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Local API error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error?.message || 'Internal server error' });
      }
    }
  };
}

async function start() {
  const [
    { default: postsHandler },
    { default: postBySlugHandler },
    { default: postBySlugQueryHandler },
    { default: relatedHandler },
    { default: categoriesHandler },
    { default: imageProxyHandler },
    { default: healthHandler },
    { default: analyticsEventHandler },
    { default: analyticsSummaryHandler },
  ] =
    await Promise.all([
      import('../api/posts/index.js'),
      import('../api/posts/[slug].js'),
      import('../api/posts/by-slug.js'),
      import('../api/posts/related.js'),
      import('../api/categories.js'),
      import('../api/image-proxy.js'),
      import('../api/health.js'),
      import('../api/analytics/event.js'),
      import('../api/analytics/summary.js'),
    ]);

  app.get('/api/posts/related', withHandler(relatedHandler));
  app.get('/api/posts/:slug', withHandler(postBySlugHandler));
  app.delete('/api/posts/:slug', withHandler(postBySlugHandler));
  app.get('/api/posts/by-slug', withHandler(postBySlugQueryHandler));
  app.delete('/api/posts/by-slug', withHandler(postBySlugQueryHandler));
  app.get('/api/posts', withHandler(postsHandler));
  app.post('/api/posts', withHandler(postsHandler));
  app.get('/api/categories', withHandler(categoriesHandler));
  app.get('/api/image-proxy', withHandler(imageProxyHandler));
  app.get('/api/health', withHandler(healthHandler));
  app.post('/api/analytics/event', withHandler(analyticsEventHandler));
  app.get('/api/analytics/summary', withHandler(analyticsSummaryHandler));
  app.delete('/api/analytics/summary', withHandler(analyticsSummaryHandler));

  const server = app.listen(port, () => {
    console.log(`Local API server listening on http://localhost:${port}`);
  });

  // Keep local dev API alive under npm/concurrently on Windows.
  server.ref();
  const keepAlive = setInterval(() => {}, 1 << 30);

  const shutdown = () => {
    clearInterval(keepAlive);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Failed to start local API server:', error);
  process.exit(1);
});
