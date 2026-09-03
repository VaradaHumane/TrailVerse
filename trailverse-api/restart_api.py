import subprocess
import time
import requests
import sys

# Kill existing uvicorn
subprocess.run(['pkill', '-f', 'uvicorn'], capture_output=True)
time.sleep(2)

# Start uvicorn
proc = subprocess.Popen([
    '/Users/varada/Developer/Projects/trailverse/trailverse-api/venv/bin/uvicorn',
    'main:app',
    '--host', '0.0.0.0',
    '--port', '8000'
], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

time.sleep(4)

try:
    resp = requests.get('http://localhost:8000/', timeout=5)
    print('API Response:', resp.status_code, resp.json())

    # Now try to execute SQL to add state column
    sql_resp = requests.post(
        'http://localhost:8000/admin/execute-sql',
        json={'sql': "ALTER TABLE treks ADD COLUMN state TEXT DEFAULT 'Maharashtra';"},
        timeout=10
    )
    print('SQL Execution:', sql_resp.status_code, sql_resp.json())

except Exception as e:
    print('Error:', e)
    stdout, stderr = proc.communicate(timeout=2)
    print('STDOUT:', stdout.decode())
    print('STDERR:', stderr.decode())
    sys.exit(1)