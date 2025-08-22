import io
import cv2
import time
import pygame
import threading
from mp_solutions import MPipe
from efficient_tracker import EfficientTracker

# Engine instances
tracker = EfficientTracker(timeout=100)
mp = MPipe(debug=True, gpu=True)

playing = False

pygame.mixer.init()

def play(file):
    print("Playing")
    global playing
    if playing:
        return
    pygame.mixer.music.load(file)
    pygame.mixer.music.play(loops=0)
    playing = True
    while pygame.mixer.music.get_busy():
        time.sleep(1)
    playing = False
    
cwidth = 640
cheight = 480

# Camera instance
cap = cv2.VideoCapture(0) # Use default camera
cap.set(cv2.CAP_PROP_FRAME_WIDTH, cwidth)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cheight)

# CV2 Window
cv2.namedWindow("CamMonitor", cv2.WINDOW_NORMAL)
cv2.resizeWindow("CamMonitor", cwidth, cheight)


# Test only: bed size
width = 0.65
height = 0.95

# Test only: Geofence dims
gx1 = round((cwidth - (width*cwidth)) / 2)
gx2 = round(gx1 + (width*cwidth))

gy1 = round((cheight - (height*cheight)) / 2)
gy2 = round((gy1 + (height*cheight)))

# Colors
green = (0,255,0)
blue = (255,0,0)
red = (0,0,255)

# Main loop
while True:
    try:
        ret, frame = cap.read()
        if not ret:
            print("Can't access to frame capture")
            break

        # Encode image
        is_success, encoded_image = cv2.imencode(".jpg", frame)
        if not is_success:
            print("Error al codificar frame")
            continue
        
        # Image size
        h, w = frame.shape[:2]

        # Convert frame to blob
        image_blob = io.BytesIO(encoded_image.tobytes())

        # Call body pose detection method
        results = mp.bodypose_detection(image_blob, normalized=False)

        # Draw bed
        cv2.rectangle(frame, (gx1, gy1), (gx2, gy2), blue, 2)
        
        # bbox
        # minx, maxx, miny, maxy = 10000, 0, 10000, 0
        
        risk = False
        lw, rw, le, re = None, None, None, None
        # draw keypoints
        for kp in results[0]["keypoints"]:
            # Retrieve coordinates
            tx, ty = kp["x"], kp["y"]
                
            if ty > h or tx > w:
                continue
            
            
            if kp["name"] == "leftWrist":
                lw = ty
            if kp["name"] == "rightWrist":
                rw = ty
            if kp["name"] == "leftElbow":
                le = ty
            if kp["name"] == "rightElbow":
                re = ty
                
            # set max and min
            if tx > gx1 and tx < gx2 and ty > gy1 and ty < gy2:
                cv2.circle(frame, (round(tx), round(ty)), 4, green, -1)
            else:
                # Detected patient in risk
                risk = True
                cv2.circle(frame, (round(tx), round(ty)), 4, red, -1)
                print(kp)
                
        if lw is not None and le is not None:
            if lw < le:
                threading.Thread(target=play, args=("./attention.mp3",), daemon=False).start()
        if rw is not None and re is not None:
            if rw < re:
                threading.Thread(target=play, args=("./attention.mp3",), daemon=False).start()
                
                
        if risk:
            threading.Thread(target=play, args=("./warn.mp3",), daemon=False).start()
            
        # Show frame in a window
        cv2.imshow("CamMonitor", frame)

        # Salir si presionas 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    except Exception as e:
        print(f"Error en bodypose_detection: {e}")

cap.release()
cv2.destroyAllWindows()