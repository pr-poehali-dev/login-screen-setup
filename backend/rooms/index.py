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
    query_params = event.get('queryStringParameters', {}) or {}
    room_id = query_params.get('room_id', '')
    action = query_params.get('action', '')
    
    headers = event.get('headers', {})
    auth_header = headers.get('authorization', headers.get('Authorization', ''))
    token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else auth_header
    
    if method == 'OPTIONS':
        return {
            'statusCode': 204,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
    conn.autocommit = True
    cursor = conn.cursor()
    
    protected_actions = ['members', 'messages', 'send', 'leave']
    if (room_id and action in protected_actions) or (method == 'POST' and action):
        if not token or len(token) < 10:
            cursor.close()
            conn.close()
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'error': 'Unauthorized - token required'})
            }
    
    if method == 'GET' and not room_id:
        cursor.execute('SELECT room_id, name, capacity, current_users as current FROM rooms ORDER BY created_at DESC')
        rooms = [dict(row) for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps(rooms)
        }
    
    if method == 'GET' and room_id and not action:
        cursor.execute('SELECT room_id, name, capacity, current_users as current FROM rooms WHERE room_id = %s', (room_id,))
        room = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not room:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'error': 'Room not found'})
            }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps(dict(room))
        }
    
    if method == 'GET' and room_id and action == 'members':
        cursor.execute(
            'SELECT user_id, nick, avatar_url, color FROM room_members WHERE room_id = %s ORDER BY joined_at',
            (room_id,)
        )
        members = [dict(row) for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps(members)
        }
    
    if method == 'GET' and room_id and action == 'messages':
        query_params = event.get('queryStringParameters', {})
        limit = int(query_params.get('limit', 30))
        limit = min(max(1, limit), 30)
        
        cursor.execute(
            '''SELECT id, room_id, user_id, nick, avatar_url, color, text, 
               to_char(created_at, \'YYYY-MM-DD"T"HH24:MI:SS"Z"\') as created_at
               FROM messages 
               WHERE room_id = %s 
               ORDER BY created_at ASC 
               LIMIT %s''',
            (room_id, limit)
        )
        
        messages = []
        for row in cursor.fetchall():
            msg = dict(row)
            messages.append({
                'id': msg['id'],
                'room_id': msg['room_id'],
                'author': {
                    'user_id': msg['user_id'],
                    'nick': msg['nick'],
                    'avatar_url': msg['avatar_url'],
                    'color': msg['color']
                },
                'text': msg['text'],
                'created_at': msg['created_at']
            })
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps(messages)
        }
    
    if method == 'POST' and not room_id:
        body_data = json.loads(event.get('body', '{}'))
        name = body_data.get('name', '').strip()
        capacity = body_data.get('capacity')
        
        if not name or len(name) < 1 or len(name) > 20:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'Name must be 1-20 characters'})
            }
        
        if not isinstance(capacity, int) or capacity < 2 or capacity > 20:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps(room)
        }
    
    if method == 'POST' and room_id and action == 'join':
        body_data = json.loads(event.get('body', '{}'))
        user_id = body_data.get('user_id', '')
        nick = body_data.get('nick', '')
        avatar_url = body_data.get('avatar_url', '')
        color = body_data.get('color', '')
        
        if not all([user_id, nick, avatar_url, color]):
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'Missing user data'})
            }
        
        cursor.execute('SELECT capacity, current_users FROM rooms WHERE room_id = %s', (room_id,))
        room = cursor.fetchone()
        
        if not room:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'Room not found'})
            }
        
        cursor.execute('SELECT 1 FROM room_members WHERE room_id = %s AND user_id = %s', (room_id, user_id))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return {
                'statusCode': 409,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'already_in_room'})
            }
        
        if room['current_users'] >= room['capacity']:
            cursor.close()
            conn.close()
            return {
                'statusCode': 409,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'room_full'})
            }
        
        cursor.execute(
            'INSERT INTO room_members (room_id, user_id, nick, avatar_url, color) VALUES (%s, %s, %s, %s, %s)',
            (room_id, user_id, nick, avatar_url, color)
        )
        
        cursor.execute('UPDATE rooms SET current_users = current_users + 1 WHERE room_id = %s', (room_id,))
        
        cursor.execute('SELECT room_id, name, capacity, current_users as current FROM rooms WHERE room_id = %s', (room_id,))
        updated_room = dict(cursor.fetchone())
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps(updated_room)
        }
    
    if method == 'POST' and room_id and action == 'leave':
        body_data = json.loads(event.get('body', '{}'))
        user_id = body_data.get('user_id', '')
        
        if not user_id:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'user_id required'})
            }
        
        cursor.execute('SELECT 1 FROM room_members WHERE room_id = %s AND user_id = %s', (room_id, user_id))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'Not in room'})
            }
        
        cursor.execute('DELETE FROM room_members WHERE room_id = %s AND user_id = %s', (room_id, user_id))
        cursor.execute('UPDATE rooms SET current_users = GREATEST(0, current_users - 1) WHERE room_id = %s', (room_id,))
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'ok': True})
        }
    
    if method == 'POST' and room_id and action == 'messages':
        body_data = json.loads(event.get('body', '{}'))
        text = body_data.get('text', '').strip()
        user_id = body_data.get('user_id', '')
        nick = body_data.get('nick', '')
        avatar_url = body_data.get('avatar_url', '')
        color = body_data.get('color', '')
        
        if not text:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'empty'})
            }
        
        if len(text) > 150:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'too_long'})
            }
        
        if not all([user_id, nick, avatar_url, color]):
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'Missing user data'})
            }
        
        cursor.execute(
            '''INSERT INTO messages (room_id, user_id, nick, avatar_url, color, text) 
               VALUES (%s, %s, %s, %s, %s, %s) 
               RETURNING id, room_id, user_id, nick, avatar_url, color, text, 
               to_char(created_at, \'YYYY-MM-DD"T"HH24:MI:SS"Z"\') as created_at''',
            (room_id, user_id, nick, avatar_url, color, text)
        )
        
        row = cursor.fetchone()
        msg = dict(row)
        
        message = {
            'id': msg['id'],
            'room_id': msg['room_id'],
            'author': {
                'user_id': msg['user_id'],
                'nick': msg['nick'],
                'avatar_url': msg['avatar_url'],
                'color': msg['color']
            },
            'text': msg['text'],
            'created_at': msg['created_at']
        }
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'message': message})
        }
    
    cursor.close()
    conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'},
        'body': json.dumps({'error': 'Method not allowed'})
    }