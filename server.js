// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// --- Config ---
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env');
  process.exit(1);
}

// --- Middleware ---
// Security headers
app.use(helmet());

// Logging
app.use(morgan('dev'));

// Body parser (JSON) with limit for base64
app.use(express.json({ limit: '10mb' }));

// CORS (restrict in production)
const allowedOrigins = [
  'http://localhost:5173',     // Dev
  'https://your-frontend.com'  // Prod – replace this
];

app.use(cors({
  origin(origin, callback) {
    // Allow tools like Postman (no origin)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));

// Basic rate limit (adjust as needed)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100,                 // limit each IP to 100 requests per window
});

app.use('/api', apiLimiter);

// --- MongoDB Connection ---
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ Mongo Connection Error:', err.message);
    process.exit(1);
  }
}

connectDB();

// --- Schema & Model ---
const trophySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
    required: true, // base64 string
  },
  createdAt: { type: Date, default: Date.now }
});

const Trophy = mongoose.model('Trophy', trophySchema);

// --- Routes ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 1. Get All
app.get('/api/trophies', async (req, res, next) => {
  try {
    const trophies = await Trophy.find().sort({ createdAt: -1 });
    res.json(trophies);
  } catch (err) {
    next(err);
  }
});

// 2. Create New
app.post('/api/trophies', async (req, res, next) => {
  try {
    const { name, description, imageUrl } = req.body;

    // Basic validation
    if (!name || !imageUrl) {
      return res.status(400).json({ message: 'Name and imageUrl are required' });
    }

    const trophy = new Trophy({ name, description, imageUrl });
    const newTrophy = await trophy.save();
    res.status(201).json(newTrophy);
  } catch (err) {
    next(err);
  }
});

// 3. Delete
app.delete('/api/trophies/:id', async (req, res, next) => {
  try {
    const deleted = await Trophy.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Trophy not found' });
    }
    res.json({ message: 'Deleted Trophy' });
  } catch (err) {
    next(err);
  }
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
