CREATE TABLE IF NOT EXISTS room_members (
  room_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  nick VARCHAR(20) NOT NULL,
  avatar_url TEXT NOT NULL,
  color VARCHAR(7) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  nick VARCHAR(20) NOT NULL,
  avatar_url TEXT NOT NULL,
  color VARCHAR(7) NOT NULL,
  text VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);