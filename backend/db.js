const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'hr_schedule.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const schemaPath = fs.existsSync(path.join(__dirname, 'schema.sql'))
  ? path.join(__dirname, 'schema.sql')
  : path.join(__dirname, '..', 'database', 'schema.sql');

// Establish connection to SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeDatabase();
  }
});

// Initialize database tables using schema.sql
function initializeDatabase() {
  try {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql, (err) => {
      if (err) {
        console.error('Error executing schema.sql:', err.message);
      } else {
        console.log('Database tables successfully initialized.');
        
        // Ensure the password column exists (for databases already created before schema modification)
        db.run("ALTER TABLE employees ADD COLUMN password TEXT NOT NULL DEFAULT 'password123'", (alterErr) => {
          if (alterErr && !alterErr.message.includes('duplicate column name')) {
            console.error('Migration error adding password column:', alterErr.message);
          } else {
            console.log('Database migration check: password column verified.');
          }
          // Seed default employees if DB is completely empty
          seedDataIfEmpty();
        });
      }
    });
  } catch (err) {
    console.error('Error reading schema.sql file:', err.message);
  }
}

// Optional: Seed the database with initial employees if empty
function seedDataIfEmpty() {
  db.get("SELECT COUNT(*) as count FROM employees", (err, row) => {
    if (err) {
      console.error('Error checking employees count:', err.message);
      return;
    }
    
    if (row.count === 0) {
      console.log('Seeding initial employee data...');
      const employees = [
        ['Sarah', 'Connor', 'sarah.connor@wetech.com', '555-0192', 'HR Manager', 'Human Resources', '2023-01-15', 'password123'],
        ['John', 'Doe', 'john.doe@wetech.com', '555-0143', 'Senior Software Engineer', 'Engineering', '2024-03-10', 'password123'],
        ['Jane', 'Smith', 'jane.smith@wetech.com', '555-0177', 'Product Designer', 'Product', '2024-05-22', 'password123'],
        ['David', 'Miller', 'david.miller@wetech.com', '555-0188', 'QA Engineer', 'Engineering', '2025-02-01', 'password123'],
        ['Emma', 'Wilson', 'emma.wilson@wetech.com', '555-0109', 'Marketing Lead', 'Marketing', '2023-11-12', 'password123']
      ];
      
      const insertEmp = db.prepare(`
        INSERT INTO employees (first_name, last_name, email, phone, role, department, hire_date, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      employees.forEach((emp) => {
        insertEmp.run(emp);
      });
      insertEmp.finalize(() => {
        console.log('Initial employees seeded.');
        seedSchedulesAndAttendance();
      });
    }
  });
}

function seedSchedulesAndAttendance() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  // Seed some schedules
  db.all("SELECT id FROM employees", (err, rows) => {
    if (err || !rows.length) return;
    
    const insertSchedule = db.prepare(`
      INSERT INTO schedules (employee_id, date, shift_start, shift_end, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const insertAttendance = db.prepare(`
      INSERT INTO attendance (employee_id, date, clock_in, clock_out, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const insertLeaves = db.prepare(`
      INSERT INTO leaves (employee_id, start_date, end_date, leave_type, status, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Let's create some dummy records for the seeded employees
    rows.forEach((emp, index) => {
      // 1. Schedules (yesterday and today)
      insertSchedule.run(emp.id, yesterday, '09:00', '17:00', 'Completed');
      insertSchedule.run(emp.id, today, '09:00', '17:00', 'Scheduled');
      
      // 2. Attendance (for yesterday, and some for today)
      if (index !== 2) { // Employee index 2 is on leave today
        // Yesterday attendance
        insertAttendance.run(emp.id, yesterday, `${yesterday} 08:55:00`, `${yesterday} 17:05:00`, 'Present');
      }
      
      if (index === 0) {
        // Today clock in
        insertAttendance.run(emp.id, today, `${today} 08:50:00`, null, 'Present');
      } else if (index === 1) {
        // Today clocked in late
        insertAttendance.run(emp.id, today, `${today} 09:15:00`, null, 'Late');
      }
      
      // 3. Leave request for Employee 2
      if (index === 2) {
        insertLeaves.run(emp.id, today, today, 'Vacation', 'Approved', 'Family visit');
      } else if (index === 3) {
        // Pending leave for next week
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        insertLeaves.run(emp.id, nextWeek, nextWeek, 'Sick', 'Pending', 'Dental checkup');
      }
    });
    
    insertSchedule.finalize();
    insertAttendance.finalize();
    insertLeaves.finalize();
    console.log('Initial schedules, attendance, and leaves seeded.');
  });
}

module.exports = db;
