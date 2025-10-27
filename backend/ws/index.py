'''
Business: WebSocket-like broadcast endpoint for room events with typing indicators
Args: POST with {type, ...data} to broadcast events
Returns: Broadcast confirmation or typing users list
'''

import json
import time
from typing import Dict, Any

typing_state: Dict[str, Dict[str, Any]] = {}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        event_type = body_data.get('type')
        
        if event_type == 'room_created':
            room = body_data.get('room')
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'status': 'broadcast',
                    'message': {'type': 'room_created', 'room': room}
                })
            }
        
        if event_type == 'member_joined':
            room_id = body_data.get('room_id')
            user = body_data.get('user')
            current = body_data.get('current')
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'status': 'broadcast',
                    'message': {'type': 'member_joined', 'room_id': room_id, 'user': user, 'current': current}
                })
            }
        
        if event_type == 'member_left':
            room_id = body_data.get('room_id')
            user_id = body_data.get('user_id')
            current = body_data.get('current')
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'status': 'broadcast',
                    'message': {'type': 'member_left', 'room_id': room_id, 'user_id': user_id, 'current': current}
                })
            }
        
        if event_type == 'message_new':
            room_id = body_data.get('room_id')
            message = body_data.get('message')
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'status': 'broadcast',
                    'message': {'type': 'message_new', 'room_id': room_id, 'message': message}
                })
            }
        
        if event_type == 'typing':
            room_id = body_data.get('room_id')
            user_id = body_data.get('user_id')
            nick = body_data.get('nick')
            
            if room_id and user_id and nick:
                if room_id not in typing_state:
                    typing_state[room_id] = {}
                
                typing_state[room_id][user_id] = {
                    'nick': nick,
                    'timestamp': time.time()
                }
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'status': 'ok'})
            }
        
        if event_type == 'get_typing':
            room_id = body_data.get('room_id')
            current_time = time.time()
            
            typing_users = []
            if room_id in typing_state:
                for user_id, data in list(typing_state[room_id].items()):
                    if current_time - data['timestamp'] < 2:
                        typing_users.append({
                            'user_id': user_id,
                            'nick': data['nick']
                        })
                    else:
                        del typing_state[room_id][user_id]
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'typing_users': typing_users})
            }
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'status': 'ok'})
    }
