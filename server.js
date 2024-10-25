const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const fileRoutes = require('./Routes/routeFile');
const { protect, authenticateToken } = require('./Controller/authMiddleware')
require('dotenv').config();
mongoose.connect(process.env.DB_URI, {});


const db = mongoose.connection
db.on("error", console.error.bind(console, 'MongoDB connection error'))
db.once("open", ()=>{
    console.log("Connected to MongoDB ");
})


const app = express();
// Parse application/json
app.use(bodyParser.json());
// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors());
app.use(express.static('uploads'));  // Servir les fichiers statiques dans le dossier 'uploads'

const server = http.createServer(app);
// const io = socketIo(server);  // Initialiser Socket.IO une fois
const io = socketIo(server, {
  cors: {
    // origin: "http://localhost:3000",  // Remplace par l'URL de ton client
    origin: "https://ia-validation.vercel.app",
    methods: ["GET", "POST"]
  }
});

app.use((req, res, next)=>{
  req.io = io
  next()
})

app.use((req, res, next) => {
  const unprotectedRoutes = ['/login', '/forgot-password', '/generateFile'];
  const resetPasswordRegex = /^\/reset-password\/[^\/]+$/; // Vérifie si l'URL correspond à /reset-password/something

  if (unprotectedRoutes.includes(req.path) || resetPasswordRegex.test(req.path)) {
    console.log("next===");
    return next(); // Skip protectMiddleware for unprotected routes
  }

  protect(req, res, next); // Apply protectMiddleware for all other routes
});

app.use('/', fileRoutes);

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
