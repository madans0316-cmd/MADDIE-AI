import os
import sys
import time
import subprocess
import json

# Auto-install dependencies if missing
try:
    import speech_recognition as sr
    import pyttsx3
    import requests
except ImportError:
    print("[Maddy OS Client] Missing dependencies. Installing SpeechRecognition, pyttsx3, requests...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "SpeechRecognition", "pyttsx3", "requests"])
    import speech_recognition as sr
    import pyttsx3
    import requests

# Express Server Endpoint
BACKEND_URL = "http://localhost:3000/api/command"

# Initialize Offline TTS Engine (Uses native Windows SAPI5)
try:
    engine = pyttsx3.init('sapi5')
except Exception:
    engine = pyttsx3.init() # Fallback

voices = engine.getProperty('voices')
# Prefer a male/female voice if available
for voice in voices:
    if "david" in voice.name.lower() or "zira" in voice.name.lower():
        engine.setProperty('voice', voice.id)
        break

engine.setProperty('rate', 175) # Conversational speaking speed

def speak(text):
    print(f"[Maddy]: {text}")
    engine.say(text)
    engine.runAndWait()

def listen_for_command(recognizer, source, is_wake_word_mode=True):
    if is_wake_word_mode:
        print("[Maddy Client] Listening for wake word: 'Maddy' or 'Hey Maddy'...")
    else:
        print("[Maddy Client] Listening for command...")
        
    try:
        audio = recognizer.listen(source, timeout=8, phrase_time_limit=5)
        transcript = recognizer.recognize_google(audio).lower().strip()
        print(f"[Heard]: \"{transcript}\"")
        return transcript
    except sr.WaitTimeoutError:
        return ""
    except sr.UnknownValueError:
        return ""
    except Exception as e:
        print(f"[Error]: {e}")
        return ""

def handle_system_command(command):
    # Send command to local Express backend
    try:
        response = requests.post(BACKEND_URL, json={"command": command}, timeout=5)
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                speak(result.get("message"))
                return True
    except Exception as e:
        print(f"[Maddy Client] Express server offline. Executing command locally. {e}")
        
    # Local fallback command handler if the Node.js server is stopped
    clean_cmd = command.lower().strip()
    if clean_cmd.startswith("open ") or clean_cmd.startswith("launch "):
        target = clean_cmd.replace("open ", "").replace("launch ", "").strip()
        if target == "notepad":
            os.system("start notepad.exe")
            speak("Opening Notepad on your laptop.")
            return True
        elif target == "calculator" or target == "calc":
            os.system("start calc.exe")
            speak("Opening Calculator.")
            return True
        elif target == "paint":
            os.system("start mspaint.exe")
            speak("Opening MS Paint.")
            return True
        elif "youtube" in target:
            os.system("start https://www.youtube.com")
            speak("Opening YouTube in your browser.")
            return True
        elif "google" in target:
            os.system("start https://www.google.com")
            speak("Opening Google.")
            return True
            
    elif clean_cmd.startswith("close ") or clean_cmd.startswith("exit "):
        target = clean_cmd.replace("close ", "").replace("exit ", "").strip()
        if target == "notepad":
            os.system("taskkill /IM notepad.exe /F")
            speak("Closed Notepad.")
            return True
        elif target == "calculator" or target == "calc":
            os.system("taskkill /IM CalculatorApp.exe /F")
            speak("Closed Calculator.")
            return True
        elif target == "paint":
            os.system("taskkill /IM mspaint.exe /F")
            speak("Closed Paint.")
            return True
            
    return False

def main():
    recognizer = sr.Recognizer()
    microphone = sr.Microphone()
    
    # Calibrate ambient noise
    with microphone as source:
        print("[Maddy Client] Calibrating microphone for ambient noise...")
        recognizer.adjust_for_ambient_noise(source, duration=1)
        
    speak("Maddy Python Voice Assistant Client is running. Say Maddy to activate.")

    while True:
        with microphone as source:
            wake_phrase = listen_for_command(recognizer, source, is_wake_word_mode=True)
            
            # Check wake word
            if "maddy" in wake_phrase or "hey maddy" in wake_phrase or "wake up" in wake_phrase or "madam" in wake_phrase:
                speak("Yes, I am awake. What is your command?")
                
                # Capture the command
                command_phrase = listen_for_command(recognizer, source, is_wake_word_mode=False)
                
                if command_phrase:
                    success = handle_system_command(command_phrase)
                    if not success:
                        # Pass to general intelligence or search
                        search_url = f"https://www.google.com/search?q={command_phrase.replace(' ', '+')}"
                        speak(f"Command not recognized as local app. Let me search Google for: {command_phrase}")
                        os.system(f"start {search_url}")
                else:
                    speak("I didn't hear a command. Returning to standby.")
                    
        time.sleep(0.5)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nExiting Maddy Voice Client...")
