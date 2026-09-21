const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const env = require('./config/env');
const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandlerMiddleware');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});
initSocket(io);

// Security & Parsing Middleware
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

// Capture raw body for Meta webhook signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
    limit: '20mb'
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static uploads serving per SOP: "Store only the upload path in the database. Frontend must append the backend domain"
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Direct Meta Webhook endpoint (as documented in Meta Dashboard / developer handover)
app.use('/webhook', require('./routes/webhookRoute'));

// API Routes
app.use('/api', routes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    product: 'WBS - WhatsApp Business Solution',
    version: '1.0.0',
    metaApiVersion: env.META_GRAPH_API_VERSION,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Production Frontend Builds Serving per SOP:
// 1. Client Frontend deployed inside backend/public (accessible at /)
// 2. Super Admin Frontend deployed inside backend/public/admin (accessible at /admin)
const publicDir = path.join(__dirname, 'public');
const adminPublicDir = path.join(publicDir, 'admin');

// Serve static assets
app.use('/admin', express.static(adminPublicDir));
app.use(express.static(publicDir));

// Admin SPA Fallback
app.get('/admin*', (req, res, next) => {
  const adminIndex = path.join(adminPublicDir, 'index.html');
  res.sendFile(adminIndex, (err) => {
    if (err) next();
  });
});

// Client SPA Fallback
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads') || req.originalUrl.startsWith('/webhook')) {
    return next();
  }
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>WBS Platform Backend</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:50px;">
          <h2>WBS (WhatsApp Business Solution) API Server Running</h2>
          <p>Environment: <b>${env.NODE_ENV}</b> | Port: <b>${env.PORT}</b></p>
          <p>API Endpoint: <a href="/api/health">/api/health</a></p>
          <p><a href="/">Client Portal</a> | <a href="/admin">Super Admin Console</a></p>
        </body>
        </html>
      `);
    }
  });
});

// Centralized error handling per SOP
app.use(errorHandler);

// Start Server
const PORT = env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[WBS Server] Running on ${env.HOST} in ${env.NODE_ENV} mode.`);
  console.log(`[WBS Server] Client Portal at ${env.HOST}/`);
  console.log(`[WBS Server] Super Admin Console at ${env.HOST}/admin/`);
});

module.exports = { app, server };
