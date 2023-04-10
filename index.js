const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();
const port = process.env.port || 5000;
require("dotenv").config();
const CLIENT_ID =
  "178339055643-f04ij0ii0ars4rq06cnhrncj6a79cfi8.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN =
  "1//043632kBx4KpACgYIARAAGAQSNwF-L9IrPItY2t2YMYyT678wu40vc3eC61qcED7HURpyXhj_Yc8Vvjd7jqxtgIqnk935JkgSNVM";
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./tmp");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
//// !middlewares ////
const upload = multer({ storage: storage }).single("image");
// async function uploadFile(imgFile) {
//   const filePath = path.join(__dirname, `${imgFile.originalname}`);
//   try {
//     const response = await drive.files.create({
//       requestBody: {
//         name: `${imgFile.originalname}`, //This can be name of your choice
//         mimeType: "image/jpg",
//       },
//       media: {
//         mimeType: "image/jpg",
//         body: fs.createReadStream(filePath),
//       },
//     });

//     console.log(response.data);
//   } catch (error) {
//     console.log(error.message);
//   }
// }
const corsOptions = {
  origin: "*",
  credentials: true, //access-control-allow-credentials:true
  optionSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Origin",
    "X-Requested-With",
    "Accept",
    "x-client-key",
    "x-client-token",
    "x-client-secret",
    "Authorization",
  ],
  
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
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
//* verify JWT
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  // console.log(req.headers.authorization);
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res
        .status(403)
        .send({ message: "from verify JWT -> forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

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
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.userRole !== "Seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
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

    app.get("/user/:email", async (req, res) => {
      const authHeader = req.headers.authorization;
      // console.log(authHeader);
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({
        // send userRole
        userRole: user?.userRole,
        // isBuyer: user?.userRole === "Buyer",
        // isSeller: user?.userRole === "Seller",
      });
    });
    // app.get("/user", async (req, res) => {
    //   const email = req.query.email;
    //   const query = { email };
    //   const user = await usersCollection.findOne(query);
    //   if (user) {
    //     return res.send({ user: user });
    //   } else {
    //     res.send({ user: null });
    //   }
    // });
    // ! POST
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const userRole = user?.userRole;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const query = { email: email };

      const isExistingUser = await usersCollection.find(query).toArray();
      // console.log(isExistingUser[0]?.userRole);
      let result = {};
      if (
        isExistingUser.length === 0 ||
        isExistingUser[0]?.userRole === userRole
      ) {
        result = await usersCollection.updateOne(filter, updatedDoc, options);
        const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
          expiresIn: "1d",
        });
        res.send({ result, token });
      }
      // console.log(res);
      else res.status(409).send({ message: "Email already in use" });
    });
    app.post("/upload", async (req, res) => {
      upload(req, res, function (err) {
        if (err) throw err;
        console.log(req.file.path);
        const filemetadata = { name: req.file.filename };
        const media = {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(req.file.path),
        };
        drive.files.create(
          {
            resource: filemetadata,
            media: media,
            fields: "id",
          },
          (err, file) => {
            if (err) throw err;
            //! delete the file images folder
            fs.unlinkSync(req.file.path);
            // res.render("success", { name: name, pic: pic, success: true });
          }
        );
      });
    });
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      console.log(product);
      // uploadFile(product);
      // console.log(product);
      // const result = await productsCollection.insertOne(product);
      // res.send(result);
    });
    // temporary to add property
    // app.get("/addData/stock", async (req, res) => {
    //   const filter = {};
    //   const options = { upsert: true };
    //   const updatedDoc = {
    //     $set: {
    //       inStock: true,
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
// Export the Express API
module.exports = app;
