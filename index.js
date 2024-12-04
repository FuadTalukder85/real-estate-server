const express = require("express");
const app = express();
const cors = require("cors");
const bcrypt = require("bcrypt");
require("dotenv").config();
const port = process.env.PORT || 4900;

// middleware
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const db = client.db("realEstate");
    const user = db.collection("users");
    const propertyCollection = db.collection("property");

    // User Registration
    app.post("/register", async (req, res) => {
      const { name, email, password, image, number, address } = req.body;

      // Check if email already exists
      const existingUser = await user.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      const joinedDate = new Date();
      const formattedDate =
        joinedDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }) +
        " " +
        joinedDate.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

      // Insert user into the database
      await user.insertOne({
        name,
        email,
        password: hashedPassword,
        image,
        number,
        address,
        date: formattedDate,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
      });
    });
    // Update user by id
    app.put("/user/:id", async (req, res) => {
      const id = req.params.id;
      const updateUser = req.body;

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const userData = {
        $set: {
          name: updateUser.name,
          image: updateUser.image,
          number: updateUser.number,
          address: updateUser.address,
        },
      };
      try {
        const result = await user.updateOne(filter, userData, options);

        // Check if the update was successful and respond accordingly
        if (result.modifiedCount === 1 || result.upsertedCount === 1) {
          res.status(200).json({ message: "user updated successfully" });
        } else {
          res.status(404).json({ error: "user not found" });
        }
      } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    // User Login
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await user.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
        expiresIn: process.env.EXPIRES_IN,
      });

      res.json({
        success: true,
        message: "Login successful",
        token,
      });
    });
    //get all users
    app.get("/users", async (req, res) => {
      const result = await user.find().toArray();
      res.send(result);
    });
    //get single user by id
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await user.findOne(query);
      res.send(result);
    });
    // make user role
    app.patch("/user/role/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      if (!role || (role !== "Admin" && role !== "Agent" && role !== "User")) {
        return res.status(400).send({ Error: "Invalid role" });
      }
      const filter = { _id: new ObjectId(id) };
      updateDoc = {
        $set: { role },
      };
      try {
        const result = await user.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating role", error);
        res.status(500).send({ error: "failed to update role" });
      }
    });
    // property api
    app.post("/property", async (req, res) => {
      const addProperty = req.body;
      try {
        // Fetch the user by email or ID (assuming req.body contains the user's email or ID)
        const userEmail = addProperty.email; // Make sure you pass `userEmail` in the request body
        const userInfo = await user.findOne({ email: userEmail });
        if (!userInfo) {
          return res
            .status(400)
            .json({ success: false, message: "User not found" });
        }
        // Check the user's role
        if (userInfo.role === "Agent") {
          addProperty.status = "pending"; // Set status to 'pending' for Agents
        } else if (userInfo.role === "Admin") {
          addProperty.status = "approved";
        }
        // Add formatted date
        const date = new Date();
        const formattedDate =
          date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          }) +
          " " +
          date.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        addProperty.date = formattedDate;
        // Insert the property into the collection
        const result = await propertyCollection.insertOne(addProperty);
        res.status(201).json({ success: true, data: result });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });
    // make approved agent property
    app.put("/property/:id", async (req, res) => {
      const propertyId = req.params.id;
      if (!ObjectId.isValid(propertyId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid property ID" });
      }
      const { status } = req.body;
      try {
        const result = await propertyCollection.updateOne(
          { _id: new ObjectId(propertyId) },
          { $set: { status } }
        );
        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({ success: false, message: "Property not found" });
        }
        res
          .status(200)
          .json({ success: true, message: `Status updated to ${status}` });
      } catch (error) {
        console.error("Error updating property:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    // get all property
    app.get("/property", async (req, res) => {
      const result = await propertyCollection.find().toArray();
      res.send(result);
    });
    //get single property by id
    app.get("/property/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(query);
      res.send(result);
    });
    // delete property by id
    app.delete("/property/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.deleteOne(query);
      res.send(result);
    });
    // Update property by id
    app.put("/property/:id", async (req, res) => {
      const id = req.params.id;
      const updateProperty = req.body;

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const propertyData = {
        $set: {
          propertyName: updateProperty.propertyName,
          propertyImage01: updateProperty.propertyImage01,
          propertyImage02: updateProperty.propertyImage02,
          propertyImage03: updateProperty.propertyImage03,
          propertyImage04: updateProperty.propertyImage04,
          price: updateProperty.price,
          propertyFor: updateProperty.propertyFor,
          propertyCategory: updateProperty.propertyCategory,
          bedroom: updateProperty.bedroom,
          bathroom: updateProperty.bathroom,
          squareFoot: updateProperty.squareFoot,
          floor: updateProperty.floor,
          buildYear: updateProperty.buildYear,
          address: updateProperty.address,
          zipCode: updateProperty.zipCode,
          city: updateProperty.city,
          country: updateProperty.country,
          description: updateProperty.description,
          status: updateProperty.status,
        },
      };
      try {
        const result = await propertyCollection.updateOne(
          filter,
          propertyData,
          options
        );

        // Check if the update was successful and respond accordingly
        if (result.modifiedCount === 1 || result.upsertedCount === 1) {
          res.status(200).json({ message: "property updated successfully" });
        } else {
          res.status(404).json({ error: "property not found" });
        }
      } catch (err) {
        console.error("Error updating property:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    // all stats
    async function getPendingPropertiesCount() {
      const client = new MongoClient(uri);
      try {
        // total properties count
        const totalProperties = await propertyCollection.countDocuments();
        // Count properties with status = "pending"
        const pendingProperties = await propertyCollection.countDocuments({
          status: "pending",
        });
        // Count properties with status = "pending"
        const totalAgent = await user.countDocuments();

        return { totalProperties, pendingProperties, totalAgent };
      } catch (error) {
        console.error("Error fetching properties:", error);
        throw error;
      } finally {
        await client.close();
      }
    }
    // API endpoint
    app.get("/allstats/count", async (req, res) => {
      try {
        const { totalProperties, pendingProperties, totalAgent } =
          await getPendingPropertiesCount();
        res.status(200).json({
          totalProperty: totalProperties,
          pendingProperty: pendingProperties,
          totalAgent: totalAgent,
        });
      } catch (error) {
        res.status(500).json({ message: "Internal server error", error });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  const serverStatus = {
    message: "Server is running smoothly",
    timestamp: new Date(),
  };
  res.json(serverStatus);
});

app.listen(port, () => {
  console.log("run");
});
