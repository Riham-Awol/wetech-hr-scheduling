const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all employees
router.get('/', (req, res) => {
  db.all('SELECT * FROM employees ORDER BY first_name ASC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET single employee by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM employees WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(row);
  });
});

// POST create a new employee
router.post('/', (req, res) => {
  const { first_name, last_name, email, phone, role, department, hire_date, password } = req.body;
  
  if (!first_name || !last_name || !email || !role || !department || !hire_date) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }

  const sql = `INSERT INTO employees (first_name, last_name, email, phone, role, department, hire_date, password)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [first_name, last_name, email, phone || null, role, department, hire_date, password || 'password123'];

  db.run(sql, params, function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'An employee with this email already exists.' });
      }
      return res.status(500).json({ error: err.message });
    }
    
    // Return created employee
    res.status(201).json({
      id: this.lastID,
      first_name,
      last_name,
      email,
      phone,
      role,
      department,
      hire_date
    });
  });
});

// PUT update an employee
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, phone, role, department, hire_date, password } = req.body;

  if (!first_name || !last_name || !email || !role || !department || !hire_date) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }

  let sql = `UPDATE employees 
             SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ?, department = ?, hire_date = ?`;
  const params = [first_name, last_name, email, phone || null, role, department, hire_date];

  if (password) {
    sql += `, password = ?`;
    params.push(password);
  }

  sql += ` WHERE id = ?`;
  params.push(id);

  db.run(sql, params, function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'An employee with this email already exists.' });
      }
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee updated successfully', id });
  });
});

// DELETE an employee
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM employees WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully', id });
  });
});

// POST employee login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter email and password.' });
  }

  db.get('SELECT id, first_name, last_name, email, role, department FROM employees WHERE email = ? AND password = ?', 
    [email, password], 
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      res.json(row);
    }
  );
});

module.exports = router;
