-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `tapswap_web`;

-- Use the database
USE `tapswap_web`;

-- Table for users
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `points` DECIMAL(15, 2) DEFAULT 0.00,
    `energy` DECIMAL(10, 2) DEFAULT 1000.00,
    `max_energy` DECIMAL(10, 2) DEFAULT 1000.00,
    `last_energy_update` INT DEFAULT UNIX_TIMESTAMP(), -- Unix timestamp in seconds
    `join_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `tasks` JSON DEFAULT '[]' -- Store completed tasks as JSON array of {id: int, completed: bool}
);

-- Table for withdrawal requests (optional, but good for tracking)
CREATE TABLE IF NOT EXISTS `withdrawals` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `method` VARCHAR(50) NOT NULL,
    `details` JSON NOT NULL, -- Stores PayPal email, bank info, crypto address etc.
    `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    `request_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Example: Add an initial user for testing (DELETE BEFORE PRODUCTION!)
-- INSERT INTO `users` (username, password_hash, points, energy, max_energy, last_energy_update, join_date, tasks) VALUES
-- ('testuser', '$2y$10$w09tM3rL6.x0VqY5D9z.0u.b4m8n3F4m8n3F4m8n3F4m8n3F4', 10000.00, 1000.00, 1000.00, UNIX_TIMESTAMP(), NOW(), '[{"id": 0, "completed": false}, {"id": 1, "completed": false}, {"id": 2, "completed": false}, {"id": 3, "completed": false}, {"id": 4, "completed": false}]');
-- (The password hash above is for 'password123'. Change it or delete this line.)