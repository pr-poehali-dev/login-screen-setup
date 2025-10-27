CREATE TABLE IF NOT EXISTS rooms (
  room_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(20) NOT NULL,
  capacity INT NOT NULL CHECK (capacity >= 2 AND capacity <= 20),
  current_users INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);