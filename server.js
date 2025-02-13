const express = require("express");
const helmet = require("helmet");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const app = express();
const upload = multer();

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5173',  // Vite's default dev server
    'https://nqx3lp4w-5173.asse.devtunnels.ms',  // VS Code frontend URL
    'https://nqx3lp4w-5000.asse.devtunnels.ms',  // VS Code backend URL
    process.env.FRONTEND_URL, // From environment variable
  ].filter(Boolean), // Remove any undefined/null values
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // Increase preflight cache to 10 minutes
};

// Apply CORS middleware before other middleware
app.use(cors(corsOptions));

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

const memorizedRoutes = require('./routes/memorizedRoutes');
app.use('/api/memorized', memorizedRoutes);

const menuRoutes = require('./routes/menuRoutes');
app.use('/api/menu', menuRoutes);

const statsRoutes = require('./routes/statsRoutes');
app.use('/api/stats', statsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
