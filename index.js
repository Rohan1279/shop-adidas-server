const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 5000;
require("dotenv").config();
const CLIENT_ID =
  "178339055643-f04ij0ii0ars4rq06cnhrncj6a79cfi8.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN =
  "1//04KSgxlczHS0fCgYIARAAGAQSNwF-L9IrBQvrd-gLm6g3-MENgJ9AQ-wXDoBoYcSqa6ygIk0HFBTfzlOl24BnAkQEJhyj-DjLOGs";
const oauth2Client = new google.auth.OAuth2(
  // process.env.CLIENT_ID,
  // process.env.CLIENT_SECRET,
  // process.env.REDIRECT_URI
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
//use service account instead of access token
// const KEYFILEPATH = path.join(`${__dirname}/../shop-adidas-acd8fa728d67.json`);
const KEYFILEPATH = path.join(__dirname, 'shop-adidas-acd8fa728d67.json');
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
//use service account instead of access token

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const drive = google.drive({
  version: "v3",
  // auth: oauth2Client,
  auth,
});

const uploadToGoogle = async (filemetadata, media) => {
  return drive.files.create({
    resource: filemetadata,
    media: media,
  });
};
const generatePublicUri = async (fileId) => {
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
    const result = await drive.files.get({
      fileId: fileId,
      fields: "webViewLink, webContentLink",
    });
    return result.data.webContentLink.replace("&export=download", "");
  } catch (error) {
    console.log(error.message);
  }
};
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./tmp"); // use /tmp when deploy to vercel
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
//// !middlewares ////
const upload = multer({ storage: storage }).single("image");
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

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    app.get("/seller_products", async (req, res) => {
      const { email, sortField, sortingOrder } = req.query;
      // const sortingOrder = req.params.sort;
      // console.log(sortField, sortingOrder);
      const query = { seller_email: email };
      const products = await productsCollection
        .find(query)
        // .sort({ sortField: -1 })
        .toArray();
      res.send(products);
    });
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

    //! Create a route to create a new folder
    app.put("/createFolder", async (req, res) => {
      try {
        // Get the folder name from the request body
        const folderName = req.body.folderName;
        // Check if a folder with the same name already exists
        const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const existingFolders = await drive.files.list({
          q: query,
          fields: "files(id)",
        });

        // If a folder with the same name already exists, return its ID
        if (existingFolders.data.files.length > 0) {
          const folderId = existingFolders.data.files[0].id;
          return res.status(200).json({
            success: true,
            message: "Folder already exists",
            folderId: folderId,
          });
        }

        // Create the folder metadata
        const folderMetadata = {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: ["1VRwJVvnXuW0y99nvevaq0cMsc2BbAbmo"],
        };

        // Create the folder in Google Drive
        const folder = await drive.files.create({
          resource: folderMetadata,
          fields: "id",
        });

        // Send the folder ID in the response
        res.status(200).json({
          success: true,
          folderId: folder.data.id,
          message: "New folder created",
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    app.post("/upload", async (req, res) => {
      let imgUrl = "";
      // console.log(req);

      upload(req, res, async function (err) {
        if (err) {
          // handle error
          return res.status(400).json({ error: "File upload failed" });
        }
        const filemetadata = {
          name: req.file.filename,
          fields: "id",
          parents: [`${req.body.folderId}`],
        };
        const media = {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(req.file.path),
        };
        // console.log(req.file);
        try {
          const googleResponse = await uploadToGoogle(filemetadata, media);
          const fileId = googleResponse.data.id;
          imgUrl = await generatePublicUri(fileId);
          fs.unlinkSync(req.file.path);
          return res.status(200).json({ fileId, imgUrl });
        } catch (error) {
          console.log(error);
        }
      });
    });
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      // console.log(result);
      res.send(result);
    });
    //! DELETE
    app.delete("/seller_products/delete", async (req, res) => {
      const productId = req.query.id;
      // const query = {};
      // console.log(productId);
      const result = productsCollection.deleteOne({ _id: ObjectId(productId) });
      res.send(result);
      if (result.deletedCount === 1) {
      }
    });
    app.delete("/files/:fileId", (req, res) => {
      const fileId = req.params.fileId;
      console.log(fileId);
      drive.files.delete({ fileId }, (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).send("Error deleting file");
        } else {
          res.send(`File with ID: ${fileId} has been deleted`);
        }
      });
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
