const express = require("express");
const app = express();
const dotenv = require("dotenv");
const axios = require("axios");
const cors = require("cors");
dotenv.config();
const {  db, connectDB } = require("./db");

connectDB()

app.use(cors());




app.listen(4000, () => {
  console.log("Server is running on port 4000");
});