const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
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
    const adidasSneakers04 = client
      .db("shop-adidas-db")
      .collection("adidas-sneakers-04");
    const usersCollection = client.db("shop-adidas-db").collection("users");
    //! GET
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
    // ! POST
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      console.log(result);

      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      console.log(token);
      res.send({ result, token });
    });
    // temporary to add property
    // app.get("/addData/colors", async (req, res) => {
    //   const filter = {};
    //   const options = { upsert: true };
    //   const updatedDoc = {
    //     $set: {
    //       color: "",
    //     },
    //   };
    //   const result = await productsCollection.updateMany(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   res.send(result);
    // });

    // update property value matched with other property name
    // app.get("/update/color", async (req, res) => {
    //   const query = {};
    //   const cursor = adidasSneakers04.find(query);
    //   const result1 = await cursor.toArray();
    //   for (const item of result1) {
    //     const result = await productsCollection.updateOne(
    //       { productLinkHref: item.productLinkHref },
    //       {
    //         $set: {
    //           color: item.color,
    //         },
    //       },
    //       { upsert: true }
    //     );

    //   //  console.log(result);
    //   }
    // });

    // renames property name in an object
    // app.patch("/rename-property", async (req, res) => {
    //   const result = await productsCollection.updateMany(
    //     {},
    //     { $rename: { "product-link-href": "productLinkHref" } }
    //   );
    //   console.log(result);
    //   res.send(result);
    // });
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
