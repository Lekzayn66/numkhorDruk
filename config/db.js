const pgp = require('pg-promise')();
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: 5432,
  database: process.env.DB_NAME || process.env.PGDATABASE || 'cars_db',
  user: process.env.DB_USER || process.env.PGUSER || 'postgres',
  password: process.env.DB_PASS || process.env.PGPASSWORD || '',
};

// Only add SSL configuration if we're in production or if SSL is explicitly required
if (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true') {
  dbConfig.ssl = {
    rejectUnauthorized: false,
  };
}

let db;

// For development, use mock database if real database fails
if (process.env.NODE_ENV === 'development' && !process.env.DB_PASS && !process.env.PGPASSWORD) {
  console.log('⚠️  Using mock database for development (no DB password set)');
  db = {
    none: () => Promise.resolve(),
    one: () => Promise.resolve(null),
    many: () => Promise.resolve([]),
    any: () => Promise.resolve([]),
    result: () => Promise.resolve({ rowCount: 0 }),
    tx: (callback) => callback(db),
    task: (callback) => callback(db),
    oneOrNone: () => Promise.resolve(null),
    manyOrNone: () => Promise.resolve([])
  };
} else {
  try {
    db = pgp(dbConfig);
    console.log('✅ Database connection configured');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    // Create a mock db object for development
    db = {
      none: () => Promise.resolve(),
      one: () => Promise.resolve(null),
      many: () => Promise.resolve([]),
      any: () => Promise.resolve([]),
      result: () => Promise.resolve({ rowCount: 0 }),
      tx: (callback) => callback(db),
      task: (callback) => callback(db),
      oneOrNone: () => Promise.resolve(null),
      manyOrNone: () => Promise.resolve([])
    };
    console.log('⚠️  Using mock database for development');
  }
}

module.exports = db;
