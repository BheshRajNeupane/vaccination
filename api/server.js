const express = require("express");
const app = express();
const dotenv = require("dotenv");
const axios = require("axios");
const cors = require("cors");
const pgp = require('pg-promise')()
dotenv.config();
const {  db, connectDB } = require("./db");

connectDB()

app.use(cors());

app.use(express.json());


app.post("/api/v1/create-users", async (req, res) => {
  const {
    name,
    phone,
    address,
    wardNo,
    age,
    maritalStatus,
    noOfChild,
    childName,
    childAge,
  } = req.body;

  try {
 
    if (!name || !phone || !address || !wardNo || !age) {
      res.status(400).json({ error: "User data is incomplete." });
      return;
    }

    if (maritalStatus && noOfChild > 0) {
      // Validate children data
      if (
        !Array.isArray(childName) ||
        !Array.isArray(childAge) ||
        childName.length !== noOfChild ||
        childAge.length !== noOfChild
      ) {
        res
          .status(400)
          .json({ error: "Number of children does not match data provided." });
        return;
      }

      // Check every child has both a name and an age
      const isValidChildren = childName.every((name, index) => name && childAge[index] !== undefined);

      if (!isValidChildren) {
        res
          .status(400)
          .json({ error: "Each child must have both a name and an age." });
        return;
      }
    }


    const newUser = await db.one(
      `INSERT INTO users (name, phone, address, wardNo, age, maritalStatus, noOfChild)
       VALUES ($1, $2, $3, $4, $5, $6,$7) RETURNING *`,
      [name, phone, address, wardNo, age, maritalStatus, noOfChild]
    );

    if (maritalStatus && noOfChild > 0) {
      const childInsertions = childName.map((child, index) => ({
        user_id: newUser.id,
        childname: child,
        childage: childAge[index],
      }));
    //Batch insert children data
      const insertQuery = pgp.helpers.insert(
        childInsertions,
        ["user_id", "childname", "childage"],
        "children"
      );

      await db.none(insertQuery);
      newUser.children = childInsertions;
    } else {
      // Insert a record in children table if no children data is provided
      await db.none(`INSERT INTO children (user_id) VALUES ($1)`, [newUser.id]);
    }

   
    res.status(201).json({
      message: "User created successfully",
      data: newUser,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/v1/users", async (req, res) => {
 try{
   const users = await db.any(`SELECT * FROM users`);
   const usersWithChildren = await Promise.all
       (users.map( async (ur) => { 
    if(ur.noofchild > 0) 
       ur.childname =  await db.any(`SELECT * FROM children WHERE user_id = $1 `, [ur.id])
   
      return ur
    }))
    res.status(200).json({ data: usersWithChildren });

 }catch(error){
   console.error("Error:", error);
   res.status(500).json({ error: error.message });
 }
})
app.get("/api/v1/users/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    // Query to fetch user and their children
    const userData = await db.task(async t => {
      const user = await t.oneOrNone(
        `SELECT * FROM users WHERE id = $1`,
        [userId]
      );

      if (!user) {
        throw new Error("User not found");
      }

      const children = await t.manyOrNone(
        `SELECT childname, childage FROM children WHERE user_id = $1`,
        [userId]
      );

      return { ...user, children };
    });

    res.status(200).json({
      message: "User data retrieved successfully",
      data: userData,
    });
  } catch (error) {
    console.error("Error fetching user data:", error.message);
    res.status(500).json({ error: error.message });
  }
});




  








  app.listen(4000, () => {
  console.log("Server is running on port 4000");
});
