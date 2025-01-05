const pgp = require('pg-promise')();

 

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'vaccination',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
};

const db = pgp(connection);

const connectDB = async () => {
  try {
    // Test database connection
    await db.connect();
    console.log("Database connected successfully");


    // Create table for users
    const createTableUser = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(15) NOT NULL,
        address VARCHAR(150) NOT NULL,
        wardNo VARCHAR(10) NOT NULL,
        age INT NOT NULL,
        maritalStatus BOOLEAN NOT NULL,
        noOfChild INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create table for children
    const createTableChildren = `
      CREATE TABLE IF NOT EXISTS children (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        childName VARCHAR(100) DEFAULT NULL,
        childAge INT  DEFAULT NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    // await db.none('DROP TABLE IF EXISTS children');
    // await db.none('DROP TABLE IF EXISTS users');
    // Execute table creation queries
    await db.none(createTableUser); // Use `none` for statements with no result
    console.log("Users table created successfully");

    await db.none(createTableChildren);
    console.log("Children table created successfully");
  } catch (error) {
    console.error("Error during database setup:", error.message || error);
  }

  return db;
};

module.exports = { db, connectDB };
