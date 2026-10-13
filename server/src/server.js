const { config, assertConfig } = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/db');
const Event = require('./models/Event');
const { createApp } = require('./app');

async function main() {
  assertConfig();

  await connectDatabase(config.mongodbUri);
  console.log('Connected to MongoDB');
  // Make sure indexes exist before serving traffic.
  await Event.init();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
    console.log(`Allowed origins: ${config.corsOrigins.join(', ')}`);
  });

  async function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
