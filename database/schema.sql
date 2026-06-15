-- Database Schema for HR Scheduling System

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    hire_date TEXT NOT NULL,
    password TEXT NOT NULL DEFAULT 'password123'
);

CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    shift_start TEXT NOT NULL, -- HH:MM
    shift_end TEXT NOT NULL, -- HH:MM
    status TEXT NOT NULL DEFAULT 'Scheduled', -- Scheduled, Completed, Off
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    clock_in TEXT, -- ISO Timestamp or HH:MM:SS
    clock_out TEXT, -- ISO Timestamp or HH:MM:SS
    status TEXT NOT NULL DEFAULT 'Present', -- Present, Late, Absent
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    start_date TEXT NOT NULL, -- YYYY-MM-DD
    end_date TEXT NOT NULL, -- YYYY-MM-DD
    leave_type TEXT NOT NULL, -- Sick, Vacation, Personal, etc.
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected
    reason TEXT,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
