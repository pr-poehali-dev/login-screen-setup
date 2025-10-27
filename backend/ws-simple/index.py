'''
Business: Simple WebSocket emulation via polling for message_new events
Args: GET ?room_id=X for polling, POST {type, room_id, message} for broadcast
Returns: New messages for subscribed room or broadcast confirmation
'''

import json
import time
from typing import Dict, Any, List

room_messages: Dict[str, List[Dict[str, Any]]] = {}
MAX_MESSAGES_PER_ROOM = 50
MESSAGE_TTL = 60

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
    
    if method == 'GET':
        query_params = event.get('queryStringParameters', {}) or {}
        room_id = query_params.get('room_id', '')
        since_timestamp = float(query_params.get('since', 0))
        
        if not room_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'room_id required'})
            }
        
        current_time = time.time()
        messages = room_messages.get(room_id, [])
        
        messages = [m for m in messages if current_time - m['timestamp'] < MESSAGE_TTL]
        room_messages[room_id] = messages
        
        new_messages = [
            m['data'] for m in messages 
            if m['timestamp'] > since_timestamp
        ]
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'messages': new_messages,
                'timestamp': current_time
            })
        }
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        event_type = body_data.get('type')
        
        if event_type == 'message_new':
            room_id = body_data.get('room_id')
            message = body_data.get('message')
            
            if not room_id or not message:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'room_id and message required'})
                }
            
            if room_id not in room_messages:
                room_messages[room_id] = []
            
            room_messages[room_id].append({
                'timestamp': time.time(),
                'data': {'type': 'message_new', 'message': message}
            })
            
            if len(room_messages[room_id]) > MAX_MESSAGES_PER_ROOM:
                room_messages[room_id] = room_messages[room_id][-MAX_MESSAGES_PER_ROOM:]
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'status': 'broadcast'})
            }
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'status': 'ok'})
    }
