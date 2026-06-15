const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all leave requests, optionally filtered by employee_id or status
router.get('/', (req, res) => {
  const { employee_id, status } = req.query;
  let sql = `
    SELECT l.*, e.first_name, e.last_name, e.department, e.role
    FROM leaves l
    JOIN employees e ON l.employee_id = e.id
  `;
  const params = [];

  if (employee_id && status) {
    sql += ' WHERE l.employee_id = ? AND l.status = ?';
    params.push(employee_id, status);
  } else if (employee_id) {
    sql += ' WHERE l.employee_id = ?';
    params.push(employee_id);
  } else if (status) {
    sql += ' WHERE l.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY l.start_date DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// POST submit a new leave request
router.post('/', (req, res) => {
  const { employee_id, start_date, end_date, leave_type, reason } = req.body;

  if (!employee_id || !start_date || !end_date || !leave_type) {
    return res.status(400).json({ error: 'Please provide employee_id, start_date, end_date, and leave_type.' });
  }

  // Check if employee exists
  db.get('SELECT id FROM employees WHERE id = ?', [employee_id], (err, emp) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    const sql = `INSERT INTO leaves (employee_id, start_date, end_date, leave_type, status, reason)
                 VALUES (?, ?, ?, ?, 'Pending', ?)`;
    const params = [employee_id, start_date, end_date, leave_type, reason || null];

    db.run(sql, params, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id: this.lastID,
        employee_id,
        start_date,
        end_date,
        leave_type,
        status: 'Pending',
        reason
      });
    });
  });
});

// PUT update leave status (Approve/Reject) or details
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { start_date, end_date, leave_type, status, reason } = req.body;

  if (!start_date || !end_date || !leave_type || !status) {
    return res.status(400).json({ error: 'Please provide start_date, end_date, leave_type, and status.' });
  }

  const sql = `UPDATE leaves 
               SET start_date = ?, end_date = ?, leave_type = ?, status = ?, reason = ?
               WHERE id = ?`;
  const params = [start_date, end_date, leave_type, status, reason || null, id];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }
    
    // If approved, optionally adjust schedules to "Off" or delete schedule conflicts
    if (status === 'Approved') {
      updateScheduleOnLeaveApproval(id);
    }

    res.json({ message: 'Leave request updated successfully', id });
  });
});

// Helper: If leave is approved, mark schedules during that range as 'Off' or update status
function updateScheduleOnLeaveApproval(leaveId) {
  db.get('SELECT * FROM leaves WHERE id = ?', [leaveId], (err, leave) => {
    if (err || !leave) return;
    
    const updateSchedSql = `
      UPDATE schedules 
      SET status = 'Off' 
      WHERE employee_id = ? 
        AND date >= ? 
        AND date <= ?
    `;
    db.run(updateSchedSql, [leave.employee_id, leave.start_date, leave.end_date], (err) => {
      if (err) console.error('Error auto-updating schedules for approved leave:', err.message);
    });
  });
}

module.exports = router;
