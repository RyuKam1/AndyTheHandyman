import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
const port = Number.parseInt(process.env.LOCAL_API_PORT || '3000', 10);

app.use(express.json({ limit: '1mb' }));

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
    { default: relatedHandler },
    { default: categoriesHandler },
    { default: imageProxyHandler },
  ] =
    await Promise.all([
      import('../api/posts/index.js'),
      import('../api/posts/[slug].js'),
      import('../api/posts/related.js'),
      import('../api/categories.js'),
      import('../api/image-proxy.js'),
    ]);

  app.get('/api/posts/related', withHandler(relatedHandler));
  app.get('/api/posts/:slug', withHandler(postBySlugHandler));
  app.delete('/api/posts/:slug', withHandler(postBySlugHandler));
  app.get('/api/posts', withHandler(postsHandler));
  app.post('/api/posts', withHandler(postsHandler));
  app.get('/api/categories', withHandler(categoriesHandler));
  app.get('/api/image-proxy', withHandler(imageProxyHandler));

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
