const express = require("express");
const helmet = require("helmet");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const app = express();
const upload = multer();

// Middleware
app.use(cors());

app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: {
      action: "deny",
    },
  }),
);
// Support for x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Support for JSON
app.use(express.json());

// Support for multipart/form-data
app.use(upload.none()); // For parsing multipart/form-data without file uploads

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB:", err));

app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/memorizations", require("./routes/memorizationRoutes"));

const surahRoutes = require('./routes/surahRoutes');
app.use('/api/surahs', surahRoutes);

const vaultRoutes = require('./routes/vaultRoutes');
app.use('/api/vault', vaultRoutes);

const revisionRoutes = require('./routes/revisionRoutes');
app.use('/api/revisions', revisionRoutes);

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
