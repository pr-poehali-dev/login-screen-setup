'''
Business: WebSocket-like broadcast endpoint for room events
Args: POST with {type, ...data} to broadcast events
Returns: Broadcast confirmation
'''

import json
from typing import Dict, Any

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
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'status': 'ok'})
    }
