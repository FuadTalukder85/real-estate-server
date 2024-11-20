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
      const { name, email, password } = req.body;

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
        date: formattedDate,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
      });
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
    // property api
    app.post("/property", async (req, res) => {
      const addProperty = req.body;
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
      const result = await propertyCollection.insertOne(addProperty);
      res.send(result);
    });
    // get all property
    app.get("/property", async (req, res) => {
      const result = await propertyCollection.find().toArray();
      res.send(result);
    });
    //get single property item by id
    app.get("/property/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(query);
      res.send(result);
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
