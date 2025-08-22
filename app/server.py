import os
import json
import requests
from pathlib import Path
from flask_cors import CORS
from lib.mp_solutions import MPipe
from flask import Flask, request, jsonify, render_template, redirect, url_for


# Flask app instance
app = Flask(__name__)
# Enable cors origin for all paths
CORS(app)

mp = MPipe(debug=True)

# Retrieve entironment variables
MASTER_USER = os.getenv("MASTER_USER") or "admin"
MASTER_PASS = os.getenv("MASTER_PASS") or "admin"
TOKEN = os.getenv("TKN") or "snlrdevops"
    
# ----------------------------------------
# --------------- ALERTS R/W STUFF -------
# ----------------------------------------


# Fences references
ALERTS_PATH = Path("./data/alerts.json")
ALERTS_PATH.parent.mkdir(parents=True, exist_ok=True)  # ensure ./data exists
ALERTS = None
alerts_file = None

try:
    alerts_file = ALERTS_PATH.open("r+", encoding="utf-8") # READ + WRITE
    try:
        ALERTS = json.load(alerts_file)
    except json.JSONDecodeError:
        # empty file or corrupt
        ALERTS = {}
        alerts_file.seek(0)
        json.dump(ALERTS, alerts_file, ensure_ascii=False, indent=2)
        alerts_file.truncate()
except FileNotFoundError:
    alerts_file = ALERTS_PATH.open("w+", encoding="utf-8")  # Create if not exists
    ALERTS = {}
    json.dump(ALERTS, alerts_file, ensure_ascii=False, indent=2)
    alerts_file.flush()

# ----------------------------------------
# --------------- FENCES R/W STUFF -------
# ----------------------------------------

# Fences references
FENCES_PATH = Path("./data/fences.json")
FENCES_PATH.parent.mkdir(parents=True, exist_ok=True)  # ensure ./data exists
FENCES = None
fences_file = None

try:
    fences_file = FENCES_PATH.open("r+", encoding="utf-8") # READ + WRITE
    try:
        FENCES = json.load(fences_file)
    except json.JSONDecodeError:
        # empty file or corrupt
        FENCES = {}
        fences_file.seek(0)
        json.dump(FENCES, fences_file, ensure_ascii=False, indent=2)
        fences_file.truncate()
except FileNotFoundError:
    fences_file = FENCES_PATH.open("w+", encoding="utf-8")  # Create if not exists
    FENCES = {}
    json.dump(FENCES, fences_file, ensure_ascii=False, indent=2)
    fences_file.flush()
    


# ----------------------------------------
# --------------- COMMON R/W STUFF -------
# ----------------------------------------

def get_file(name):
    """
    Read fences/alerts json file content.
    """
    global fences_file
    global alerts_file
    
    file = fences_file if name == "fences" else alerts_file
    file.seek(0)  # back to begining
    try:
        return json.load(file)
    except json.JSONDecodeError:
        return {}  # Empty or corrupted file


def update_file(name, data):
    """
    Update fences json file content.
    """
    global fences_file
    global alerts_file
    
    file = fences_file if name == "fences" else alerts_file
    
    file.seek(0)  # back to begining
    json.dump(data, file, ensure_ascii=False, indent=2)
    file.truncate() # Delete exeded data
    file.flush() 
    


# ----------------------------------------
# --------------- Response standards -----
# ----------------------------------------

def user_error(error):
    """
    Args:
        error (str): Error message
    """
    return jsonify({ "status": "fail", "error": error }), 400

def server_error(error):
    """
    Args:
        error (str): Error message
    """
    return jsonify({ "status": "fail", "error": f"Server error: {error}" }), 500

def success(response):
    """
    Args:
        response (dict): Response object
    """
    response["status"] = "ok"
    return jsonify(response), 200

# ----------------------------------------
# --------------- STATIC STUFF -----------
# ----------------------------------------

@app.route("/", methods=["POST", "GET"])
def home():
    """
    Login transaction
    ---
    Args:
        user (str): User name
        pass (str): Password
    Returns:
        json: error or token for future transactions
    """
    global MASTER_USER
    global MASTER_PASS
    global TOKEN
    try:
        if request.method == "GET":
            # Validate and return auth
            auth = request.args.get("auth")
            print(auth)
            if auth:
                return render_template("index.html", auth=auth)
            
            # Retrieve errors
            error = request.args.get("error")
            server = request.args.get("server")
            # Return login template
            return render_template("login.html", error=error, server=server)
        
        elif request.method == "POST":
            # Retrieve params
            params = request.get_json(silent=True) or request.form
            # Validate that credentials are provided
            if "user" not in params:
                return redirect(url_for("home", error="Required parameter 'user' not found."))
            if "pass" not in params:
                return redirect(url_for("home", error="Required parameter 'pass' not found."))
            
            req_user = params.get("user")
            req_pass = params.get("pass")
            # Validate vredentials
            if req_user == MASTER_USER and req_pass == MASTER_PASS:
                return redirect(url_for("home", auth=TOKEN))
            
            return redirect(url_for("home", error="Wrong credentials!"))
        
    except Exception as err:
        print(f"Static server error: {str(err)}")
        return redirect(url_for("home", server=err))
# --------------------------------------------------------------------
# --------------------------------------------------------------------


# ----------------------------------------
# --------------- MEDIAPIPE STUFF --------
# ----------------------------------------
    
@app.route('/vision/pose', methods=['POST'])
def pose_detect():
    """
    Detect body pose
    ---
    Args:
        image* (file): Image file
        normalized (bool): Normalized coordinates
    """
    # Preflight
    if request.method == "OPTIONS":
        return ("", 204)
    global mp
    try:
        # Retrieve and validate params        
        if 'image' not in request.files:
            return user_error("Required param 'image' not found.")
        params = request.form
        
        # Retrieve and convert image
        image = request.files['image']
        
        # Retrieve normalized param
        normalized = params.get("normalized", "false").lower() == "true"
        track = params.get("track", "false").lower() == "true"
        
        # Request inference
        results = mp.bodypose_detection(image, normalized)
        
        results = { "detections": results }
        if track:
            results["warning"] = "Body pose detects only one people result, prefering the closer person."
            
        return success(results)
    except Exception as err:
        print(f"Pose detection error: {str(err)}")
        return server_error(f"Pose detection error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------
    

@app.route('/vision/segment', methods=['POST'])
def segment_touch():
    """
    Segment an image
    ---
    Args:
        image* (file): Image file
        x (float): X coordinate
        y (float): Y coordinate
    """
    # Preflight
    if request.method == "OPTIONS":
        return ("", 204)
    global mp
    try:
        # Retrieve and validate params        
        if 'image' not in request.files:
            return user_error("Required param 'image' not found.")
        
        params = request.form
        
        if 'x' not in params:
            return user_error("Required param 'x' not found.")
        if 'y' not in params:
            return user_error("Required param 'y' not found.")
        
        # Retrieve and convert image
        image = request.files['image']
        x = float(params.get("x"))
        y = float(params.get("y"))
        normalized = params.get("normalized") or False
            
        # Request inference
        results = mp.interactive_segmentation(image, x, y, normalized)
            
        return success({ "detections": results })
    except Exception as err:
        print(f"Touch segmentation error: {str(err)}")
        return server_error(f"Touch segmentation error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------

# ----------------------------------------
# --------------- FENCES STORAGE STUFF ---
# ----------------------------------------

@app.route('/fences/save', methods=['POST'])
def save_fence():
    """
    Save a new fence
    ---
    Args:
        id (str): Fence id
        data (dict): Fence data
    """
    try:
        params = request.get_json()
        
        if "id" not in params:
            user_error('Missing required param "id".')
        if "data" not in params:
            user_error('Missing required param "data".')
            
        id = params["id"]
        data = params["data"]
        
        # Update fence
        FENCES[id] = data
        update_file("fences", FENCES)
        
        # Return response
        return success({ "message": "Fence have been saved succesfully.", "data": FENCES })
    except Exception as err:
        print(f"Save fence error: {str(err)}")
        return server_error(f"Save fence error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------


@app.route('/fences/load', methods=['GET'])
def load_fence():
    """
    Load all fence data
    ---
    """
    try:        
        # Return response
        return success({ "data": get_file("fences") })
    except Exception as err:
        print(f"Load fences error: {str(err)}")
        return server_error(f"Load fences error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------


@app.route('/fences/remove', methods=['POST'])
def remove_fence():
    """
    Save a new fence
    ---
    Args:
        id (str): Fence id
    """
    try:
        params = request.get_json()
        
        if "id" not in params:
            user_error('Missing required param "id".')
            
        id = params["id"]
        
        # Remove fence
        del FENCES[id]
        update_file("fences", FENCES)
        
        # Return response
        return success({ "message": "Fence have been deleted succesfully.", "data": FENCES })
    except Exception as err:
        print(f"Save fence error: {str(err)}")
        return server_error(f"Save fence error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------

    

# ----------------------------------------
# --------------- alerts STORAGE STUFF ---
# ----------------------------------------

@app.route('/alerts/save', methods=['POST'])
def save_alert():
    """
    Save a new alert
    ---
    Args:
        id (str): Alert id
        data (dict): Alert data
    """
    try:
        params = request.get_json()
        
        if "id" not in params:
            user_error('Missing required param "id".')
        if "data" not in params:
            user_error('Missing required param "data".')
            
        id = params["id"]
        data = params["data"]
        
        # Update fence
        ALERTS[id] = data
        update_file("alerts", ALERTS)
        
        # Return response
        return success({ "message": "Fence have been saved succesfully.", "data": ALERTS })
    except Exception as err:
        print(f"Save fence error: {str(err)}")
        server_error(f"Save fence error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------


@app.route('/alerts/load', methods=['GET'])
def load_alert():
    """
    Load all alert data
    ---
    """
    try:        
        # Return response
        return success({ "data": get_file("alerts") })
    except Exception as err:
        print(f"Load alerts error: {str(err)}")
        server_error(f"Load alerts error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------


@app.route('/alerts/remove', methods=['POST'])
def remove_alert():
    """
    Save a new alert
    ---
    Args:
        id (str): Fence id
    """
    try:
        params = request.get_json()
        
        if "id" not in params:
            user_error('Missing required param "id".')
            
        id = params["id"]
        
        # Remove alert
        del ALERTS[id]
        update_file("alerts", ALERTS)
        
        # Return response
        return success({ "message": "Fence have been deleted succesfully.", "data": ALERTS })
    except Exception as err:
        print(f"Remove alert error: {str(err)}")
        server_error(f"Remove alert error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------


@app.route('/alerts/mail', methods=['POST'])
def send_mail():
    try:
        params = request.get_json()
        
        if "id" not in params or "data" not in params:
            return user_error(f"Missing required parameter {'id' if 'id' not in params else 'data'}.")
        
        GMAIL_URL = f"https://script.google.com/macros/s/{params['id']}/exec"
        
        upstream = requests.post(
                GMAIL_URL,
                headers={
                    "Content-Type": "application/json"
                },
                data=json.dumps(params['data']),
                timeout=15,  # seconds
            )
        try:
            data = upstream.json()
            return success(data)
        except ValueError:
            # Not JSON; return plaintext so you can inspect the upstream body.
            return success({ "response": upstream.text })
    except Exception as err:
        print(f"Send mail error: {str(err)}")
        return server_error(f"Send mail error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------


@app.route('/alerts/telegram', methods=['POST'])
def send_tg():
    try:
        params = request.form
        req_files = request.files
        
        # Validate image
        if "image" not in req_files:
            return user_error('Missing required parameter "image".')
        # Validate basic params
        if "id" not in params or "chat_id" not in params or "content" not in params:
            return user_error(f"Missing required parameter {'id' if 'id' not in params else 'chat_od' if 'chat_id' not in params else 'content' }.")
        
        id = params["id"]
        image = req_files.get("image")
        mimetype = image.mimetype or 'application/octet-stream'
        
        TG_URL = f"https://api.telegram.org/{id}/sendPhoto"
        
        tg_form = {}
        
        tg_form["chat_id"] = params["chat_id"]
        tg_form["caption"] = params["content"]
        files = { "photo": ("evidence", image.stream, mimetype)}
        
        upstream = requests.post( TG_URL, data=tg_form, files=files, timeout=15)
        try:
            data = upstream.json()
            return success(json.dumps(data))
        except ValueError:
            # Not JSON; return plaintext so you can inspect the upstream body.
            return success({ "response": upstream.text })
    except Exception as err:
        print(f"Telegram send error: {str(err)}")
        return server_error(f"Telegram send error: {str(err)}")
# --------------------------------------------------------------------
# --------------------------------------------------------------------
    

    

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)