const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');
const employeesRouter = require('./routes/employees');
const schedulesRouter = require('./routes/schedules');
const attendanceRouter = require('./routes/attendance');
const leavesRouter = require('./routes/leaves');
const exportRouter = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files automatically
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/employees', employeesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/export', exportRouter);

// Catch-all route to serve the index.html or simple notification
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the WeTech HR Schedule System API' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Frontend served directly at http://localhost:${PORT}`);
});
