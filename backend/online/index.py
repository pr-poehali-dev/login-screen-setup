'''
Business: Online users management with long polling
Args: GET to fetch online list, POST to update heartbeat
Returns: List of online users (auto-cleanup old connections)
'''

import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn)

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
            'body': '',
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            cutoff_time = datetime.now() - timedelta(seconds=30)
            
            cursor.execute(
                "DELETE FROM online_users WHERE last_seen < %s",
                (cutoff_time,)
            )
            conn.commit()
            
            cursor.execute(
                "SELECT user_id, nick, avatar_url, color FROM online_users ORDER BY nick"
            )
            users = cursor.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'users': [dict(u) for u in users]
                }),
                'isBase64Encoded': False
            }
        
        elif method == 'POST':
            headers = event.get('headers', {})
            token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
            
            if not token:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Missing token'}),
                    'isBase64Encoded': False
                }
            
            body_data = json.loads(event.get('body', '{}'))
            user_id = body_data.get('user_id')
            nick = body_data.get('nick')
            avatar_url = body_data.get('avatar_url')
            color = body_data.get('color')
            
            if not all([user_id, nick, avatar_url, color]):
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Missing required fields'}),
                    'isBase64Encoded': False
                }
            
            cursor.execute(
                """
                INSERT INTO online_users (user_id, nick, avatar_url, color, token, last_seen)
                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) 
                DO UPDATE SET last_seen = CURRENT_TIMESTAMP
                """,
                (user_id, nick, avatar_url, color, token)
            )
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'status': 'online'}),
                'isBase64Encoded': False
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Method not allowed'}),
                'isBase64Encoded': False
            }
    
    finally:
        cursor.close()
        conn.close()
