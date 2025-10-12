const express = require('express');
const path = require('path');
const cors = require('cors');
const { PORT } = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Mount all API routes
app.use('/api', routes);

// Global error handler (must be after routes)
app.use(errorHandler);

// Serve frontend for all other routes (catch-all)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/master.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
