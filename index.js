const express = require("express");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
// sslcommerz
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWORD;
const is_live = false; //true for live, false for sandbox

const http = require("http");
const server = http.createServer(app);
const socketIo = require("socket.io");
const io = socketIo(server, {
  cors: {
    // origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
    allowEIO3: true,
  },
  transports: ["websocket", "polling", "flashsocket"],
});

const cors = require("cors");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const port = 5000;
// socket.io

// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     // origin: "http://localhost:5173",
//     methods: ["GET", "POST"],
//   },
// });

const CLIENT_ID =
  "178339055643-f04ij0ii0ars4rq06cnhrncj6a79cfi8.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN =
  "1//04Erarq_r79TgCgYIARAAGAQSNwF-L9Ir8to-u2UsDwvZ4XTToe_6VYY6XFH3PGxxlZRG9NPhBBHrIJWtLJCt4G66mwpo68k7QgU";
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
const KEYFILEPATH = path.join(__dirname, "shop-adidas-acd8fa728d67.json");
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
//use service account instead of access token

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const drive = google.drive({
  version: "v3",
  // auth: oauth2Client, // with OAuth 2.0
  auth, // with service account
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
    cb(null, "/tmp"); // use /tmp when deploy to vercel
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
app.use(cors());
// app.use((req, res, next) => {
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   next();
// });
app.use(express.json());

app.get("/", (req, res) => {
  res.send("simple nodeserver running");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const SSLCommerzPayment = require("sslcommerz-lts");
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
    const messagesCollection = client
      .db("shop-adidas-db")
      .collection("messages");
    const ordersCollection = client.db("shop-adidas-db").collection("orders");
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
    app.get("/seller/buyerDetail", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (user) {
        return res.send({ user: user });
      } else {
        res.send({ user: null });
      }
    });

    app.get("/seller_products", async (req, res) => {
      const sortOrder = {};
      const {
        email,
        currentPage,
        limit,
        dateOrder,
        priceOrder,
        ratingsOrder,
        search = "",
      } = req.query;
      console.log("---------------------------");

      console.log("dateOrder", parseInt(dateOrder));
      console.log("priceOrder", parseInt(priceOrder));
      console.log("ratingsOrder", parseInt(ratingsOrder));

      if (!parseInt(priceOrder) && !parseInt(ratingsOrder)) {
        sortOrder.posted_on = parseInt(dateOrder);
      } else if (!parseInt(dateOrder) && !parseInt(ratingsOrder)) {
        sortOrder.price = parseInt(priceOrder);
      } else if (!parseInt(priceOrder) && !parseInt(dateOrder)) {
        sortOrder.ratings = parseInt(ratingsOrder);
      }

      // console.log(sortOrder);
      const query = {
        seller_email: email,
        $or: [
          { name: { $regex: search, $options: "i" } }, // search by product name
          { category: { $regex: search, $options: "i" } }, // search by category
          { description: { $regex: search, $options: "i" } }, // search by description
          { brand: { $regex: search, $options: "i" } }, // search by brand
          // { posted_on: { $regex: search, $options: "i" } }, // search by date
          { color: { $regex: search, $options: "i" } }, // search by color
        ],
      };
      const products = await productsCollection
        .find(query)
        // -1 -> descending ||  1 -> ascending
        .sort(sortOrder)
        .skip(parseInt(currentPage) * parseInt(limit))
        .limit(parseInt(limit))
        .toArray();
      const count = await productsCollection.find(query).toArray();

      // console.log(products?.length);
      products.map((product) => {
        // console.log(product?.name);
        // console.log(product?.category);
      });
      console.log("---------------------------");

      // Update the document
      // const result = await productsCollection.updateMany(
      //   { seller: "Adidas" },
      //   { $set: { brand: "Adidas" } }
      // );
      //   console.log(result);

      res.send([...products, { count: count?.length }]);
    });
    app.get("/seller/messages", async (req, res) => {
      // console.log(req.query.seller);
      if (req.query.seller) {
        const query = { seller: req.query.seller };
        const result = await messagesCollection.find(query).toArray();
        // console.log(result);
        const extractedData = result.map((obj) => {
          return {
            _id: obj._id,
            buyer: obj.buyer,
            room: obj.room,
            buyer_image: obj.buyer_image,
            messages: obj.messages[obj.messages.length - 1],
          };
        });
        res.send(extractedData);
      }
    });
    app.get("/buyer/messages", async (req, res) => {
      // console.log(req.query.seller);
      if (req.query.buyer) {
        const query = { buyer: req.query.buyer };
        const result = await messagesCollection.find(query).toArray();
        // console.log(result);
        const extractedData = result.map((obj) => {
          return {
            _id: obj._id,
            seller: obj.seller,
            room: obj.room,
            seller_image: obj.seller_image,
            messages: obj.messages[obj.messages.length - 1],
          };
        });
        // console.log(extractedData);
        res.send(extractedData);
      }
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
    // ! BUYERS'S ORDER
    app.post("/buyer/order", async (req, res) => {
      const { products, email, name, country, state, city, zip, phone } =
        req.body;
      // console.log(products);
      const getOrderedProducts = async () => {
        const resultPromises = products.map(async (product) => {
          const result = await productsCollection.findOne({
            _id: ObjectId(product._id),
          });
          return {
            ...result,
            quantity: product.quantity,
            size: product.size,
          };
        });

        const results = await Promise.all(resultPromises);
        return results;
      };
      const orderedProducts = await getOrderedProducts();
      const totalPrice = orderedProducts.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
      const transactionId = new ObjectId().toString();
      const data = {
        total_amount: totalPrice,
        currency: "USD",
        tran_id: transactionId, // use unique tran_id for each api call
        success_url: `http://localhost:5000/payment/success?transactionId=${transactionId}`,
        fail_url: "http://localhost:5000/payment/fail",
        cancel_url: "http://localhost:5000/payment/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: name,
        cus_email: email,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: city,
        cus_state: state,
        cus_postcode: zip,
        cus_country: country,
        cus_phone: phone,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        ordersCollection.insertOne({
          ...req.body,
          price: totalPrice,
          transactionId,
          isPaid: false,
        });
        res.send({ url: GatewayPageURL });
      });
    });
    app.post("/payment/success", async (req, res) => {
      const { transactionId } = req.query;
      console.log(transactionId);
      const result = await ordersCollection.updateOne(
        { transactionId },
        { $set: { isPaid: true, paidAt: new Date() } }
      );
      if (result.modifiedCount > 0) {
        res.redirect(
          `http://localhost:5173/payment/success?trnasactionId=${transactionId}`
        );
      }
    });

    //! PUT
    app.put("/products", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const filter = { _id: ObjectId(product._id) };
      const option = { upsert: true };
      // console.log(product);
      const updatedDoc = {
        $set: {
          category_id: product.category_id,
          category: product.category,
          description: product.description,
          price: product.price,
          name: product.name,
          color: product.color,
          brand: product.brand,
          stock: product.stock,
          promo_price: product.promo_price,
          sizes: product.sizes,
          imgId: product.imgId,
          img: product.img,
          googleFolderId: product.googleFolderId,
        },
      };
      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        // product,
        option
      );
      res.send(result);
    });
    //! DELETE
    app.delete(
      "/seller_products/delete",
      verifyJWT,
      verifySeller,
      async (req, res) => {
        const productId = req.query.id;
        // const query = {};
        // console.log(productId);
        const result = productsCollection.deleteOne({
          _id: ObjectId(productId),
        });
        res.send(result);
        if (result.deletedCount === 1) {
        }
      }
    );
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
    // ! SELLER CHAT | SOCKET.IO
    io.on("connection", async (socket) => {
      //! buyer's chat
      socket.on("join_room/buyer", async (data) => {
        // console.log(data); // { room: 'adidas@adidas.com+bipil14415@meidecn.com' }
        socket.join(data?.room);
        // // console.log(`user with id: ${socket.id} joined room: ${room}`);
        const chats = await messagesCollection
          .find({ room: data?.room })
          .toArray();
        // Send chat history to the joining user
        socket.emit("chat_history/buyer", chats);
        socket.to(data?.room).emit("chat_history/buyer", chats);
      });
      //! seller's chat
      socket.on("join_room/seller", async (data) => {
        console.log(data); // { room: 'adidas@adidas.com+bipil14415@meidecn.com' }
        socket.join(data?.room);
        // // console.log(`user with id: ${socket.id} joined room: ${room}`);
        const chats = await messagesCollection
          .find({ room: data?.room })
          .toArray();
        console.log("");
        // console.log(chats);
        // Send chat history to the joining user
        socket.emit("chat_history/seller", chats);
        socket.to(data?.room).emit("chat_history/seller", chats);
      });

      socket.on("send_message", async (data) => {
        // console.log(data);
        // await messagesCollection.insertOne(data);
        // socket.to(data?.room).emit("receive_message", data);

        const filter = { buyer: data?.buyer, room: data?.room };
        const option = { upsert: true };
        const updatedDoc = {
          $set: {
            buyer: data?.buyer,
            buyer_image: data?.buyer_image,
            seller_image: data?.seller_image,
            room: data?.room,
            messages: data?.messages,
            seller: data?.seller,
          },
        };
        const result = await messagesCollection.updateOne(
          filter,
          updatedDoc,
          option
        );
        // console.log(data);
        socket.emit("receive_message", data);
        socket.to(data?.room).emit("receive_message", data);
      });

      socket.on("disconnect", () => {
        // console.log("User disconnected", socket.id);
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
    // app.get("/update/seller_name", async (req, res) => {
    //   const query = { seller_email: "adidas@adidas.com" };
    //   // const cursor = adidasSneakers04.find(query);
    //   // const result = await cursor.toArray();
    //   // for (const item of result) {
    //   //   const result = await productsCollection.updateOne(
    //   //     { productLinkHref: item.productLinkHref },
    //   //     {
    //   //       $set: {
    //   //         color: item.color,
    //   //       },
    //   //     },
    //   //     { upsert: true }
    //   //   );

    //   //   //  console.log(result);
    //   // }
    //   const products = await productsCollection.find(query).toArray();
    //   const result = await productsCollection.updateMany(query, {
    //     $set: {
    //       seller_name: "adidas",
    //     },
    //   });
    //   console.log(result);
    //   res.send(products);
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

// app.listen(port, () => {
//   // after adding mongo db uri
//   client.connect((err) => {
//     if (err) {
//       //catch database error
//       console.log(err);
//     } else {
//       console.log("Connected to MongoDB");
//     }
//   });
//   console.log(`shop-adidas-server running on port ${port}`, "color: red");
// });
server.listen(port, () => {
  console.log(`SOCKET.IO SERVER RUNNING ON PORT ${port}`);
});

// Export the Express API
module.exports = app;
