import os
import cv2
import base64
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.components import containers
import torch

# # Audio data for sound classifications
# AudioData = mp.tasks.components.containers.AudioData

class MPipe:
    # Constructor
    def __init__(self, debug=False):
        """
        Create a mediapipe solutions instance
        ---
        <br/>
        Args:
            detection_treshold (float, optional): Treshold where detection confidence is taken. Defaults to 0.5.
            debug (bool, optional): Run in debug mode to show step by step execution in console. Defaults to False.
            gpu (bool, optional): Load models into gpu. Defaults to False.
        """
        try:
            gpu_available = torch.cuda.is_available()
            delegate = delegate=python.BaseOptions.Delegate.GPU if gpu_available else python.BaseOptions.Delegate.CPU
            self.debug = debug
            if debug:
                print("Loading Bodypose model...")
            bpmodel_path = python.BaseOptions(model_asset_path='./models/pose_landmarker.task', delegate=delegate)
            bpoptions = vision.PoseLandmarkerOptions(base_options=bpmodel_path, num_poses=10, output_segmentation_masks=True)
            self.bodypose_detector = vision.PoseLandmarker.create_from_options(bpoptions)
            if debug:
                print("Cargando modelo MagicTouch (Interactive Segmenter)...")
            imodel = python.BaseOptions(model_asset_path='./models/magic_touch.tflite', delegate=delegate)
            ioptions = vision.InteractiveSegmenterOptions(
                base_options=imodel,
                output_category_mask=True,
                output_confidence_masks=True
            )
            self.interactive_segmenter = vision.InteractiveSegmenter.create_from_options(ioptions)
            if debug:
                print("Start engine finished...")
        except Exception as err:
            print(err)
            raise ValueError(f"Error loading mediapipe solutions: {err}")
            
    
    
    # DECODE BLOB IMAGE
    def _decode_image(self, blob_image):
        """
        Decode a blob image into mediapipe image object
        ---
        <br/>
        Args:
            blob_image (str): Image binary to convert into Mediapipe image object
        Returns:
            Mediapipe Image: Mediapipe image object
        """
        try:
            # Read as buffer
            buffer = blob_image.read()
            # Convert bytes into numpy array
            np_arr = np.frombuffer(buffer, np.uint8)
            # Decode the numpy array into an OpenCV image (BGR)
            image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("Failed to decode image.")

            # Convert BGR to RGB
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Create MediaPipe Image object
            return mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        except Exception as err:
            raise ValueError(f"MP: Error trying to decode image: {err}")
            
    
    # ENCODE INTO BASE 64 STRING
    def _encode64(self, image_like, mime_type="image/jpeg") -> str:
        """
        Converts an image (np.ndarray) to base64 image string.
        ---
        <br/>
        Args:
            image_like: mp.Image o np.ndarray.
            mime_type: Type of MIME content ("image/jpeg" o "image/png").
        Returns:
            str: Base64 image string.
        """
        try:
            # Rebuild 3 channel image data
            gray_image = (image_like * 255).astype(np.uint8)

            # Encode image
            ext = ".jpg" if "jpeg" in mime_type else ".png"
            success, encoded_image = cv2.imencode(ext, gray_image)
            if not success:
                raise ValueError("No se pudo codificar la imagen.")

            # Encode ito base64 image
            b64_str = base64.b64encode(encoded_image.tobytes()).decode("utf-8")
            
            return f"data:{mime_type};base64,{b64_str}"
        except Exception as err:
            raise ValueError(f"MP: Error encoding image: {err}")

    # BODY LANDMARKS NAMES
    _body_landmarks = [
        "nose",
        "leftEyeInner",
        "leftEye",
        "leftEyeOuter",
        "rightEyeInner",
        "rightEye",
        "rightEyeOuter",
        "leftEar",
        "rightEar",
        "mouthLeft",
        "mouthRight",
        "leftShoulder",
        "rightShoulder",
        "leftElbow",
        "rightElbow",
        "leftWrist",
        "rightWrist",
        "leftPinky",
        "rightPinky",
        "leftIndex",
        "rightIndex",
        "leftThumb",
        "rightThumb",
        "leftHip",
        "rightHip",
        "leftKnee",
        "rightKnee",
        "leftAnkle",
        "rightAnkle",
        "leftHeel",
        "rightHeel",
        "leftFootIndex",
        "rightFootIndex"
    ]

    
    # BODY POSE DETECTION
    def bodypose_detection(self, image, normalized=True):
        """
        Body pose detection
        ---
        <br/>
        Args:
            image (blob): Blob image
            normalized (bool, optional): Results with normalized 3d coordinates . Default true.
        Returns:
            list: Each detected body object with segmentation mask and keypoints
                - segmentation_mask: Body segmentation mask
                - keypoints: Each landmark detected with "name", "x/y/z" position
                - world_keypoints: Each landmark detected with "name", "x/y/z" position
        """
        try:
            # Decode blob image
            decoded_img = self._decode_image(image)
            # Image width and height
            iw = decoded_img.width
            ih = decoded_img.height
            
            # Request hand pose detection
            bodypose_results = self.bodypose_detector.detect(decoded_img)
            
            # Map detection results
            results = [
                {
                    # Convert segmentation mask into base64 image
                    "segmentation_mask": self._encode64(bodypose_results.segmentation_masks[index].numpy_view()),
                    # Landmark name and coordinates in 3d relative space (normalized by default)
                    "keypoints": [
                        {
                            "name": self._body_landmarks[lmindex],
                            "x": lm.x if normalized else lm.x * iw,
                            "y": lm.y if normalized else lm.y * ih,
                            "z": lm.z if normalized else lm.z * iw,
                            
                        }
                        for lmindex, lm in enumerate(pose)
                    ],
                    # Landmark name and coordinates in 3d absolute space (normalized by default)
                    "world_keypoints": [
                        {
                            "name": self._body_landmarks[lmindex],
                            "x": lm.x if normalized else lm.x * iw,
                            "y": lm.y if normalized else lm.y * ih,
                            "z": lm.z if normalized else lm.z * iw,
                            
                        }
                        for lmindex, lm in enumerate(bodypose_results.pose_world_landmarks[index])
                    ]
                }
                for index, pose in enumerate(bodypose_results.pose_landmarks)
            ]
            
            # Return results
            return results
            
        except Exception as err:
            raise ValueError(f"MP: Bodypose detection error: {err}")
        
    def interactive_segmentation(self, image, touch_x: float, touch_y: float, normalized: bool = True):
        """
        Magic Touch segmentation
        Args:
            image (file-like): Blob/archivo con bytes de imagen.
            touch_x (float): X del toque. Normalizada [0,1] si normalized=True, en píxeles si normalized=False.
            touch_y (float): Y del toque. Normalizada [0,1] si normalized=True, en píxeles si normalized=False.
            normalized (bool): Indica si touch_x/touch_y ya están normalizados.
        Returns:
            dict:
                - category_mask (str, opcional): máscara binaria (base64).
                - confidence_mask (str, opcional): máscara de confianza (base64).
        """
        try:
            # Decodificar a mp.Image (RGB)
            mp_img = self._decode_image(image)

            # Normalizar coordenadas si vienen en píxeles
            x = touch_x
            y = touch_y
            if not normalized:
                x = float(touch_x) / mp_img.width
                y = float(touch_y) / mp_img.height
            # Clamp por seguridad
            x = max(0.0, min(1.0, x))
            y = max(0.0, min(1.0, y))

            # Construir ROI: keypoint normalizado
            NormalizedKeypoint = containers.keypoint.NormalizedKeypoint
            RegionOfInterest = vision.InteractiveSegmenterRegionOfInterest
            roi = RegionOfInterest(
                format=RegionOfInterest.Format.KEYPOINT,
                keypoint=NormalizedKeypoint(x=x, y=y)
            )

            # Ejecutar segmentación
            result = self.interactive_segmenter.segment(mp_img, roi)

            outputs = {}
            # category_mask: mp.Image con dtype uint8 (0/1)
            if getattr(result, "category_mask", None) is not None:
                outputs["category_mask"] = self._encode64(result.category_mask.numpy_view())
            # confidence_masks: lista de mp.Image float32 [0..1]; tomamos el primer canal
            if getattr(result, "confidence_masks", None):
                outputs["confidence_mask"] = self._encode64(result.confidence_masks[0].numpy_view())
            return outputs

        except Exception as err:
            raise ValueError(f"MP: Error en segmentación interactiva: {err}")
