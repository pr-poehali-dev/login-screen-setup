'''
Business: Guest authentication endpoint - creates guest user session
Args: event with POST body {nick, avatar, color}
Returns: {user_id, token, nick, avatar_url, color}
'''

import json
import os
import time
import random
import string
from typing import Dict, Any

def generate_user_id() -> str:
    timestamp = int(time.time())
    random_part = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"g-{timestamp}-{random_part}"

def generate_token() -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits, k=64))

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body_data = json.loads(event.get('body', '{}'))
        
        nick = body_data.get('nick', '').strip()
        if not nick or len(nick) < 1 or len(nick) > 20:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Nick must be 1-20 characters'}),
                'isBase64Encoded': False
            }
        
        avatar = body_data.get('avatar', {})
        avatar_type = avatar.get('type', 'preset')
        avatar_value = avatar.get('value', 'preset_0.png')
        
        if avatar_type == 'custom':
            avatar_url = avatar_value
        else:
            avatar_url = f"https://cdn.poehali.dev/4x/placeholder.svg"
        
        color = body_data.get('color', '#00FFFF')
        
        user_id = generate_user_id()
        token = generate_token()
        
        response_data = {
            'user_id': user_id,
            'token': token,
            'nick': nick,
            'avatar_url': avatar_url,
            'color': color
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(response_data),
            'isBase64Encoded': False
        }
    
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Invalid JSON'}),
            'isBase64Encoded': False
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
