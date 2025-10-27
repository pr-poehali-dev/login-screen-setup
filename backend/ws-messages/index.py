'''
Business: WebSocket emulation via long-polling for message_new events only
Args: GET ?token=X&room_id=Y for polling, POST {room_id, message} for broadcast
Returns: New messages for subscribed room or broadcast confirmation
'''

import json
import time
from typing import Dict, Any, List

# In-memory storage: room_id -> list of messages with timestamps
room_messages: Dict[str, List[Dict[str, Any]]] = {}
MAX_MESSAGES_PER_ROOM = 100
MESSAGE_TTL = 120  # 2 minutes

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    # Long-polling: GET ?token=X&room_id=Y&since=timestamp
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        token = params.get('token')
        room_id = params.get('room_id')
        since_str = params.get('since', '0')
        
        if not token:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Token required'})
            }
        
        if not room_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'room_id required'})
            }
        
        # Basic token validation
        if len(token) < 10:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid token'})
            }
        
        try:
            since = float(since_str)
        except ValueError:
            since = 0
        
        # Clean old messages
        current_time = time.time()
        if room_id in room_messages:
            room_messages[room_id] = [
                msg for msg in room_messages[room_id]
                if current_time - msg['timestamp'] < MESSAGE_TTL
            ]
        
        # Get new messages
        new_messages = []
        if room_id in room_messages:
            new_messages = [
                {'type': 'message_new', 'message': msg['data']}
                for msg in room_messages[room_id]
                if msg['timestamp'] > since
            ]
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'messages': new_messages,
                'timestamp': current_time
            })
        }
    
    # Broadcast: POST {room_id, message}
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        room_id = body_data.get('room_id')
        message = body_data.get('message')
        
        if not room_id or not message:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'room_id and message required'})
            }
        
        # Store message with timestamp
        if room_id not in room_messages:
            room_messages[room_id] = []
        
        room_messages[room_id].append({
            'timestamp': time.time(),
            'data': message
        })
        
        # Keep only recent messages
        if len(room_messages[room_id]) > MAX_MESSAGES_PER_ROOM:
            room_messages[room_id] = room_messages[room_id][-MAX_MESSAGES_PER_ROOM:]
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'status': 'broadcasted'})
        }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }
