CREATE TABLE IF NOT EXISTS online_users (
  user_id VARCHAR(100) PRIMARY KEY,
  nick VARCHAR(20) NOT NULL,
  avatar_url TEXT NOT NULL,
  color VARCHAR(7) NOT NULL,
  token VARCHAR(64) NOT NULL,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_online_users_last_seen ON online_users(last_seen);
