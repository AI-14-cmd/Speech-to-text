import subprocess
import sys

print("Installing dependencies with Python 3.12...")
subprocess.run(["py", "-3.12", "-m", "pip", "install", "-r", "requirements.txt"], check=True)

print("\nBuilding executable (takes 5-10 minutes)...")
cmd = [
    "py", "-3.12", "-m", "PyInstaller",
    "--name=SpeechToText",
    "--onedir",
    "--noconsole",
    "--add-data=templates;templates",
    "--add-data=static;static",
    "--hidden-import=whisper",
    "--hidden-import=flask",
    "--hidden-import=flask_socketio",
    "--hidden-import=engineio",
    "--hidden-import=socketio",
    "--collect-all=whisper",
    "app.py"
]

result = subprocess.run(cmd)

if result.returncode == 0:
    print("\n✓ Success!")
    print("\nExecutable location: dist/SpeechToText/SpeechToText.exe")
    print("\nTo deploy: Give client the entire 'dist/SpeechToText' folder")
else:
    print("\n✗ Build failed")
    sys.exit(1)
