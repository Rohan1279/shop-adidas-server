const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.port || 5000;
require("dotenv").config();

//middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("simple nodeserver running");
});

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.lgtzpwm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// add below codes
// https://shop-adidas.vercel.app
async function run() {
  try {
    const productsCollection = client
      .db("shop-adidas-db")
      .collection("all-products");
    const categoriesCollection = client
      .db("shop-adidas-db")
      .collection("categories");
    //read all products data
    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productsCollection.find(query);
      const products = await cursor.toArray();
      res.send(products);
    });
    //read categories data
    app.get("/categories", async (req, res) => {
      const query = {};
      const cursor = categoriesCollection.find(query).sort({ id: 1 });
      const categories = await cursor.toArray();
      res.send(categories);
    });
    //read categories data
    app.get("/categories/:id", async (req, res) => {
      const id = req.params.id;
      const query = { category_id: id };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });
  } finally {
    //don't add close()
  }
}
run().catch((err) => console.log(err));

app.listen(port, () => {
  // after adding mongo db uri
  client.connect((err) => {
    if (err) {
      //catch database error
      console.log(err);
    } else {
      console.log("Connected to MongoDB");
    }
  });
  console.log(`simple node server running on port ${port}`);
});
