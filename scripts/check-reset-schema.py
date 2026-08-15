import urllib.request, urllib.error

env = {}
with open(r'E:\dev\JuegaHipHop\lobby\.env.local', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

url = env.get('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
key = env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')

def col_exists(table, col):
    req = urllib.request.Request(
        url + f'/rest/v1/{table}?select={col}&limit=1',
        headers={'apikey': key, 'Authorization': 'Bearer ' + key},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return True, r.status
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')[:150]
        if 'PGRST' in body or 'column' in body.lower() or '42703' in body:
            return False, f"{e.code} {body}"
        return True, f"{e.code} {body}"

checks = [
    ('game_events', 'game_id'),
    ('game_events', 'user_id'),
    ('game_sessions', 'game_id'),
    ('game_sessions', 'user_id'),
    ('game_sessions', 'total_score'),
    ('game_sessions', 'ended_at'),
    ('game_state', 'game_id'),
    ('game_state', 'user_id'),
    ('game_state', 'state'),
    ('game_state', 'best_score'),
    ('game_state', 'progress_current'),
    ('player_profiles', 'user_id'),
    ('player_profiles', 'xp'),
    ('user_game_progress', 'game_id'),
    ('game_completions', 'game_id'),
    ('achievement_unlocks', 'user_id'),
    ('achievements', 'game_id'),
]
for t, c in checks:
    ok, info = col_exists(t, c)
    print(f"{'OK ' if ok else 'FALTA'} {t}.{c}  -> {info}")
