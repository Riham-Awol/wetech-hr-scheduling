const express = require('express');
const router = express.Router();
const db = require('../db');

// GET attendance logs, optionally filtered by date or employee_id
router.get('/', (req, res) => {
  const { employee_id, date } = req.query;
  let sql = `
    SELECT a.*, e.first_name, e.last_name, e.department, e.role
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
  `;
  const params = [];

  if (employee_id && date) {
    sql += ' WHERE a.employee_id = ? AND a.date = ?';
    params.push(employee_id, date);
  } else if (employee_id) {
    sql += ' WHERE a.employee_id = ?';
    params.push(employee_id);
  } else if (date) {
    sql += ' WHERE a.date = ?';
    params.push(date);
  }

  sql += ' ORDER BY a.date DESC, a.clock_in DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// POST clock-in
router.post('/clock-in', (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) {
    return res.status(400).json({ error: 'Please provide employee_id.' });
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
  const fullTimestamp = `${dateStr} ${timeStr}`;

  // Check if employee exists
  db.get('SELECT id FROM employees WHERE id = ?', [employee_id], (err, emp) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    // Check if already clocked in today
    db.get('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, dateStr], (err, record) => {
      if (err) return res.status(500).json({ error: err.message });
      if (record) {
        return res.status(400).json({ error: 'Employee already clocked in today.' });
      }

      // Check today's schedule to see if employee is late
      db.get('SELECT shift_start FROM schedules WHERE employee_id = ? AND date = ?', [employee_id, dateStr], (err, sched) => {
        let status = 'Present';
        if (sched) {
          const shiftStartParts = sched.shift_start.split(':');
          const shiftStartMinutes = parseInt(shiftStartParts[0]) * 60 + parseInt(shiftStartParts[1]);
          const clockInMinutes = now.getHours() * 60 + now.getMinutes();
          
          // Allow a 5-minute grace period
          if (clockInMinutes > shiftStartMinutes + 5) {
            status = 'Late';
          }
        }

        const sql = `INSERT INTO attendance (employee_id, date, clock_in, clock_out, status)
                     VALUES (?, ?, ?, NULL, ?)`;
        db.run(sql, [employee_id, dateStr, fullTimestamp, status], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({
            message: 'Clock-in successful',
            recordId: this.lastID,
            time: fullTimestamp,
            status
          });
        });
      });
    });
  });
});

// POST clock-out
router.post('/clock-out', (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) {
    return res.status(400).json({ error: 'Please provide employee_id.' });
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
  const fullTimestamp = `${dateStr} ${timeStr}`;

  // Find active clock-in for today or recent day (where clock_out is null)
  db.get(
    'SELECT * FROM attendance WHERE employee_id = ? AND clock_out IS NULL ORDER BY date DESC, clock_in DESC LIMIT 1',
    [employee_id],
    (err, record) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!record) {
        return res.status(400).json({ error: 'No active clock-in session found for this employee.' });
      }

      const sql = 'UPDATE attendance SET clock_out = ? WHERE id = ?';
      db.run(sql, [fullTimestamp, record.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          message: 'Clock-out successful',
          recordId: record.id,
          time: fullTimestamp
        });
      });
    }
  );
});

// POST manual record by HR
router.post('/', (req, res) => {
  const { employee_id, date, clock_in, clock_out, status } = req.body;

  if (!employee_id || !date || !clock_in) {
    return res.status(400).json({ error: 'Please provide employee_id, date, and clock_in time.' });
  }

  const sql = `INSERT INTO attendance (employee_id, date, clock_in, clock_out, status)
               VALUES (?, ?, ?, ?, ?)`;
  const params = [employee_id, date, clock_in, clock_out || null, status || 'Present'];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({
      id: this.lastID,
      employee_id,
      date,
      clock_in,
      clock_out,
      status: status || 'Present'
    });
  });
});

// PUT update attendance record (HR edits)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { date, clock_in, clock_out, status } = req.body;

  if (!date || !clock_in || !status) {
    return res.status(400).json({ error: 'Please provide date, clock_in, and status.' });
  }

  const sql = `UPDATE attendance 
               SET date = ?, clock_in = ?, clock_out = ?, status = ?
               WHERE id = ?`;
  const params = [date, clock_in, clock_out || null, status, id];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }
    res.json({ message: 'Attendance record updated successfully', id });
  });
});

module.exports = router;
