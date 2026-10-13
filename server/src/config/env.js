require('dotenv').config();

function parseList(value, fallback) {
  if (!value || !value.trim()) return fallback;
  return value
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsePositiveInt(process.env.PORT, 4000),
  mongodbUri: process.env.MONGODB_URI || '',
  corsOrigins: parseList(process.env.CORS_ORIGINS, [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ]),
  rateLimitPerMinute: parsePositiveInt(process.env.RATE_LIMIT_PER_MINUTE, 300),
};

function assertConfig() {
  if (!config.mongodbUri) {
    throw new Error(
      'MONGODB_URI is not set. Copy server/.env.example to server/.env and add your MongoDB Atlas connection string.'
    );
  }
}

module.exports = { config, assertConfig };
