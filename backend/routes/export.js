const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to escape CSV fields
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// GET /schedules - Export schedules as CSV
router.get('/schedules', (req, res) => {
  const sql = `
    SELECT s.date, s.shift_start, s.shift_end, s.status,
           e.first_name, e.last_name, e.email, e.department, e.role
    FROM schedules s
    JOIN employees e ON s.employee_id = e.id
    ORDER BY s.date DESC, e.first_name ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    let csvContent = 'Date,Employee Name,Email,Department,Role,Shift Start,Shift End,Status\r\n';
    
    rows.forEach(row => {
      const name = `${row.first_name} ${row.last_name}`;
      const line = [
        row.date,
        name,
        row.email,
        row.department,
        row.role,
        row.shift_start,
        row.shift_end,
        row.status
      ].map(escapeCSV).join(',');
      
      csvContent += line + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=schedules.csv');
    res.status(200).send(csvContent);
  });
});

// GET /attendance - Export attendance logs as CSV
router.get('/attendance', (req, res) => {
  const sql = `
    SELECT a.date, a.clock_in, a.clock_out, a.status,
           e.first_name, e.last_name, e.email, e.department, e.role
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    ORDER BY a.date DESC, a.clock_in DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    let csvContent = 'Date,Employee Name,Email,Department,Role,Clock In,Clock Out,Status\r\n';
    
    rows.forEach(row => {
      const name = `${row.first_name} ${row.last_name}`;
      const line = [
        row.date,
        name,
        row.email,
        row.department,
        row.role,
        row.clock_in || 'N/A',
        row.clock_out || 'N/A',
        row.status
      ].map(escapeCSV).join(',');
      
      csvContent += line + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
    res.status(200).send(csvContent);
  });
});

module.exports = router;
