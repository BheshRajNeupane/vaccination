const express = require("express");
const app = express();
const dotenv = require("dotenv");
const axios = require("axios");
const cors = require("cors");
const pgp = require("pg-promise")();
dotenv.config();
const { db, connectDB } = require("./db");

connectDB();

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
      const isValidChildren = childName.every(
        (name, index) => name && childAge[index] !== undefined
      );

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
    }
    //if no children ,no need to insert  null in  children table
    //else {
    //   // Insert a record in children table if no children data is provided
    //   await db.none(`INSERT INTO children (user_id) VALUES ($1)`, [newUser.id]);
    // }

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
  try {
    const users = await db.any(`SELECT * FROM users`);
    const usersWithChildren = await Promise.all(
      users.map(async (ur) => {
        if (ur.noofchild > 0)
          ur.childname = await db.any(
            `SELECT * FROM children WHERE user_id = $1 `,
            [ur.id]
          );

        return ur;
      })
    );
    res.status(200).json({ data: usersWithChildren });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/v1/users/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    // Query to fetch user and their children
    const userData = await db.task(async (t) => {
      const user = await t.oneOrNone(`SELECT * FROM users WHERE id = $1`, [
        userId,
      ]);

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

app.patch("/api/v1/users/update/:id", async (req, res) => {
  const userId = req.params.id;
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
    // Input validation
    if (!name || !phone || !address || !wardNo || !age) {
      return res.status(400).json({ error: "Required user data is missing." });
    }

    if (maritalStatus && noOfChild > 0) {
      // Validate children data
      if (
        !Array.isArray(childName) ||
        !Array.isArray(childAge) ||
        childName.length !== noOfChild ||
        childAge.length !== noOfChild
      ) {
        return res.status(400).json({
          error: "Number of children does not match data provided.",
        });
      }

      // Check every child has both a name and an age
      const isValidChildren = childName.every(
        (name, index) => name && childAge[index] !== undefined
      );

      if (!isValidChildren) {
        return res.status(400).json({
          error: "Each child must have both a name and an age.",
        });
      }
    }

    // Use transaction for atomic operations
    const result = await db.tx(async (t) => {
      // Check if user exists
      const existingUser = await t.oneOrNone(
        "SELECT * FROM users WHERE id = $1",
        [userId]
      );

      if (!existingUser) {
        return res.status(400).json({ message: "User not found." });
      }

      // Update user data
      // updated_at = CURRENT_TIMESTAMP
      const updatedUser = await t.one(
        `UPDATE users 
         SET name = $1, phone = $2, address = $3, "wardno" = $4, 
             age = $5, "maritalstatus" = $6, "noofchild" = $7
           
         WHERE id = $8 
         RETURNING *`,
        [name, phone, address, wardNo, age, maritalStatus, noOfChild, userId]
      );

      // Handle children data
      if (maritalStatus && noOfChild > 0) {
        // Delete existing children records
        await t.none("DELETE FROM children WHERE user_id = $1", [userId]);

        // Prepare children data for insertion
        const childInsertions = childName.map((child, index) => ({
          user_id: userId,
          childname: child,
          childage: childAge[index],
        }));

        // Batch insert new children data
        const insertQuery = pgp.helpers.insert(
          childInsertions,
          ["user_id", "childname", "childage"],
          "children"
        );
        await t.none(insertQuery);

        // Attach children to response
        updatedUser.children = childInsertions;
      } else {
        // Clear children records if no children
        await t.none("DELETE FROM children WHERE user_id = $1", [userId]);
        updatedUser.children = [];
      }

      return updatedUser;
    });

    res.status(200).json({
      message: "User updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error updating user data:", error);
    res.status(500).json({ error: error.message });
  }
});

//now delete turn
app.delete("/api/v1/users/delete/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await db.oneOrNone(`SELECT * FROM users WHERE id = $1`, [
      userId,
    ]);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    await db.none(`DELETE FROM children WHERE user_id = $1`, [userId]);
    await db.none(`DELETE FROM users WHERE id = $1`, [userId]);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create vaccination info
app.post("/api/v1/create-vaccinationInfo", async (req, res) => {
  const { vaccination_name, date, remarks } = req.body;

  try {
    // Validate input
    if (!vaccination_name || !date || !remarks) {
      res.status(400).json({ error: "Vaccination Info is incomplete." });
      return;
    }

    // Insert vaccination info
    const newVaccinationInfo = await db.one(
      `
      INSERT INTO vaccinationInfo (vaccination_name, date, remarks)
      VALUES ($1, $2, $3) RETURNING *`,
      [vaccination_name, date, remarks]
    );

    res.status(201).json({
      message: "Vaccination Info created successfully",
      data: newVaccinationInfo,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to create Vaccination Info." });
  }
});

// Read vaccination info
app.get("/api/v1/vaccinationInfo", async (req, res) => {
  try {
    // Fetch all vaccination info, format the date to YYYY-MM-DD, and sort by date
    const vaccinationInfo = await db.any(
      `SELECT id, 
              vaccination_name, 
              TO_CHAR(date, 'YYYY-MM-DD') AS date, 
              remarks, 
              TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
       FROM vaccinationInfo
       ORDER BY date ASC`
    );

    res.status(200).json({ data: vaccinationInfo });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch Vaccination Info." });
  }
});

// Delete vaccination info
app.delete("/api/v1/vaccinationInfo/delete/:id", async (req, res) => {
  const vaccinationInfoId = req.params.id;

  try {
    // Check if the vaccination info exists
    const vaccinationInfo = await db.oneOrNone(
      `SELECT * FROM vaccinationInfo WHERE id = $1`,
      [vaccinationInfoId]
    );

    if (!vaccinationInfo) {
      res.status(404).json({ message: "Vaccination Info not found" });
      return;
    }

    // Delete the vaccination info
    await db.none(`DELETE FROM vaccinationInfo WHERE id = $1`, [
      vaccinationInfoId,
    ]);

    res.status(200).json({ message: "Vaccination Info deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to delete Vaccination Info." });
  }
});

app.listen(4000, () => {
  console.log("Server is running on port 4000");
});
