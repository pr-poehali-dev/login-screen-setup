import json
import os
import time
import random
import string
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
    conn.autocommit = True
    cursor = conn.cursor()
    
    if method == 'GET':
        cursor.execute('SELECT room_id, name, capacity, current_users as current FROM rooms ORDER BY created_at DESC')
        rooms = [dict(row) for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(rooms)
        }
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        name = body_data.get('name', '').strip()
        capacity = body_data.get('capacity')
        
        if not name or len(name) < 1 or len(name) > 20:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Name must be 1-20 characters'})
            }
        
        if not isinstance(capacity, int) or capacity < 2 or capacity > 20:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Capacity must be 2-20'})
            }
        
        room_id = f"r-{int(time.time())}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=6))}"
        
        cursor.execute(
            "INSERT INTO rooms (room_id, name, capacity, current_users) VALUES (%s, %s, %s, 0)",
            (room_id, name, capacity)
        )
        
        room = {
            'room_id': room_id,
            'name': name,
            'capacity': capacity,
            'current': 0
        }
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(room)
        }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }
