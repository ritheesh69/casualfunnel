const mongoose = require('mongoose');

mongoose.set('strictQuery', true);
// Fail fast instead of hanging when the database is unreachable.
mongoose.set('bufferTimeoutMS', 5000);

async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
