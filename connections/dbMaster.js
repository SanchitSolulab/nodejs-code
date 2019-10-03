// Bring Mongoose into the app
const mongoose = require('mongoose');
const config = require('../config/config'); // for db connection strings and settings
const logger = require('../common/middlewares/logger');
// Create the database connection
const db = mongoose.createConnection(config.db.str, config.db.options);
// mongoose.set('debug', true);

// CONNECTION EVENTS


// When successfully connected
db.on('connected', () => {
  logger.info('Mongoose connection open to master DB');
});

// If the connection throws an error
db.on('error', (err) => {
  logger.debug(`Mongoose connection error for master DB: ${err}`);
});

// When the connection is disconnected
db.on('disconnected', () => {
  logger.debug('Mongoose connection disconnected for master DB');
});

// When connection is reconnected
db.on('reconnected', () => {
  logger.info('Mongoose connection reconnected for master DB');
});
// If the Node process ends, close the Mongoose connection
process.on('SIGINT', () => {
  db.close(() => {
    logger.debug('Mongoose connection disconnected for master DB through app termination');
    process.exit(0);
  });
});

module.exports = db;
