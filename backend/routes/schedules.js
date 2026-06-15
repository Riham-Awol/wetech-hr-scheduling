const express = require('express');
const router = express.Router();
const db = require('../db');

// GET schedules, with optional employee_id or date filters
router.get('/', (req, res) => {
  const { employee_id, date } = req.query;
  let sql = `
    SELECT s.*, e.first_name, e.last_name, e.department, e.role
    FROM schedules s
    JOIN employees e ON s.employee_id = e.id
  `;
  const params = [];

  if (employee_id && date) {
    sql += ' WHERE s.employee_id = ? AND s.date = ?';
    params.push(employee_id, date);
  } else if (employee_id) {
    sql += ' WHERE s.employee_id = ?';
    params.push(employee_id);
  } else if (date) {
    sql += ' WHERE s.date = ?';
    params.push(date);
  }
  
  sql += ' ORDER BY s.date DESC, s.shift_start ASC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// POST create/assign a schedule
router.post('/', (req, res) => {
  const { employee_id, date, shift_start, shift_end, status } = req.body;

  if (!employee_id || !date || !shift_start || !shift_end) {
    return res.status(400).json({ error: 'Please provide employee_id, date, shift_start, and shift_end.' });
  }

  // Check if employee exists
  db.get('SELECT id FROM employees WHERE id = ?', [employee_id], (err, emp) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const sql = `INSERT INTO schedules (employee_id, date, shift_start, shift_end, status)
                 VALUES (?, ?, ?, ?, ?)`;
    const params = [employee_id, date, shift_start, shift_end, status || 'Scheduled'];

    db.run(sql, params, function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        employee_id,
        date,
        shift_start,
        shift_end,
        status: status || 'Scheduled'
      });
    });
  });
});

// PUT update a schedule
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { date, shift_start, shift_end, status } = req.body;

  if (!date || !shift_start || !shift_end || !status) {
    return res.status(400).json({ error: 'Please provide date, shift_start, shift_end, and status.' });
  }

  const sql = `UPDATE schedules 
               SET date = ?, shift_start = ?, shift_end = ?, status = ?
               WHERE id = ?`;
  const params = [date, shift_start, shift_end, status, id];

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }
    res.json({ message: 'Schedule updated successfully', id });
  });
});

// DELETE a schedule
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM schedules WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }
    res.json({ message: 'Schedule deleted successfully', id });
  });
});

// POST bulk create/update schedules for an employee (Self-scheduling)
router.post('/bulk', (req, res) => {
  const { employee_id, schedules } = req.body;

  if (!employee_id || !Array.isArray(schedules)) {
    return res.status(400).json({ error: 'Please provide employee_id and schedules array.' });
  }

  // Find employee and their role to perform validations
  db.get('SELECT role FROM employees WHERE id = ?', [employee_id], (err, emp) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    const roleLower = emp.role.toLowerCase();
    const isDeveloper = roleLower.includes('engineer') || roleLower.includes('developer');

    // Group schedules by date
    const scheduleByDate = {};
    schedules.forEach(item => {
      if (!scheduleByDate[item.date]) {
        scheduleByDate[item.date] = [];
      }
      scheduleByDate[item.date].push(item);
    });

    const uniqueDays = Object.keys(scheduleByDate);
    const dayCount = uniqueDays.length;

    // Apply validations
    if (isDeveloper) {
      // Developers: at least 3 days a week, at least 1 period per day
      if (dayCount < 3) {
        return res.status(400).json({ error: 'Developers must schedule at least 3 days a week.' });
      }
      for (let date of uniqueDays) {
        if (scheduleByDate[date].length < 1) {
          return res.status(400).json({ error: `You must select at least 1 shift period for ${date}.` });
        }
      }
    } else {
      // Regular: at least 5 days a week, at least 2 periods per day
      if (dayCount < 5) {
        return res.status(400).json({ error: 'Non-developer staff must schedule at least 5 days a week.' });
      }
      for (let date of uniqueDays) {
        if (scheduleByDate[date].length < 2) {
          return res.status(400).json({ error: `You must select at least 2 shift periods for ${date}.` });
        }
      }
    }

    if (uniqueDays.length === 0) {
      return res.status(400).json({ error: 'Please select at least one day and shift period.' });
    }

    // Delete schedules for this employee for the selected dates, then insert new ones
    const datesPlaceholder = uniqueDays.map(() => '?').join(',');
    const deleteSql = `DELETE FROM schedules WHERE employee_id = ? AND date IN (${datesPlaceholder})`;
    const deleteParams = [employee_id, ...uniqueDays];

    db.run(deleteSql, deleteParams, function(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({ error: deleteErr.message });
      }

      // Now insert new records
      const insertSql = `INSERT INTO schedules (employee_id, date, shift_start, shift_end, status)
                         VALUES (?, ?, ?, ?, ?)`;
      
      const insertStmt = db.prepare(insertSql);
      
      let hasError = false;
      let errorMsg = '';
      
      db.serialize(() => {
        schedules.forEach(item => {
          insertStmt.run([employee_id, item.date, item.shift_start, item.shift_end, item.status || 'Scheduled'], (runErr) => {
            if (runErr) {
              hasError = true;
              errorMsg = runErr.message;
            }
          });
        });
        
        insertStmt.finalize((finErr) => {
          if (hasError || finErr) {
            return res.status(500).json({ error: errorMsg || (finErr ? finErr.message : 'Error writing schedules.') });
          }
          res.json({ message: 'Schedules successfully updated!', daysCount: dayCount });
        });
      });
    });
  });
});

module.exports = router;
