from deepface import DeepFace
from models import db, Face, Person
import os
import uuid
import cv2

# Base directory for saving cropped face images
FACES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'faces')
os.makedirs(FACES_DIR, exist_ok=True)


def detect_and_save_faces(image_path, photo_id, user_id=None, detector_backend='retinaface'):
    """
    Detects ALL faces in an image (handles group photos too),
    crops and saves them to disk, stores metadata in DB,
    and auto-recognises known faces when user_id is provided.

    FIX: face_filename column now stores just the UUID filename (e.g. 'abc123.jpg'),
         NOT an encrypted full path.  This makes face serving reliable on all platforms.
    """
    try:
        faces_data = DeepFace.extract_faces(
            img_path=image_path,
            detector_backend=detector_backend,
            enforce_detection=False
        )
    except Exception as e:
        print(f"[DeepFace] extract_faces error: {e}")
        # Fallback to opencv cascade if retinaface fails
        try:
            faces_data = DeepFace.extract_faces(
                img_path=image_path,
                detector_backend='opencv',
                enforce_detection=False
            )
        except Exception as e2:
            print(f"[DeepFace] opencv fallback error: {e2}")
            return []

    saved_faces = []

    for i, face_data in enumerate(faces_data):
        confidence = face_data.get('confidence', 0)
        if confidence < 0.5:
            continue

        face_img = face_data['face']
        # convert float [0,1] -> uint8 [0,255]
        if face_img.max() <= 1.0:
            face_img = (face_img * 255).astype('uint8')
        else:
            import numpy as np
            face_img = face_img.astype('uint8')

        # Save cropped face - use UUID so filenames are unpredictable (security)
        face_filename = f"{uuid.uuid4().hex}.jpg"
        face_full_path = os.path.join(FACES_DIR, face_filename)
        cv2.imwrite(face_full_path, cv2.cvtColor(face_img, cv2.COLOR_RGB2BGR))

        # Try auto-recognition against known faces for this user
        person_id = None
        person_name = 'Unknown'

        if user_id:
            matched_id = recognize_face(face_full_path, user_id)
            if matched_id:
                person_id = matched_id
                person = Person.query.get(matched_id)
                person_name = person.name if person else 'Unknown'

        # FIXED: store just the filename, not encrypted full path
        new_face = Face(
            photo_id=photo_id,
            face_filename=face_filename,   # ← KEY FIX
            face_path=face_full_path,      # kept for compat but NOT used for serving
            person_id=person_id,
            confidence=round(float(confidence), 4)
        )
        db.session.add(new_face)
        db.session.commit()

        saved_faces.append({
            'face_id': new_face.id,
            'face_filename': face_filename,
            'person_id': person_id,
            'person_name': person_name,
            'confidence': round(float(confidence), 2),
            'auto_recognized': person_id is not None
        })

    return saved_faces


def recognize_face(face_path, user_id):
    """
    Compares a face against all known (labelled) faces for this user.
    Returns person_id if a match is found, else None.
    """
    try:
        # Get all labelled faces for this user
        known_faces = (
            db.session.query(Face)
            .join(Person, Face.person_id == Person.id)
            .filter(Person.user_id == user_id, Face.person_id.isnot(None))
            .all()
        )

        if not known_faces:
            return None

        best_match = None
        best_distance = 0.40  # lower = stricter

        for kf in known_faces:
            # Resolve the real path on disk
            real_path = kf.face_path if kf.face_path and os.path.exists(kf.face_path) \
                        else os.path.join(FACES_DIR, kf.face_filename)

            if not os.path.exists(real_path):
                continue

            try:
                result = DeepFace.verify(
                    img1_path=face_path,
                    img2_path=real_path,
                    model_name='Facenet512',
                    detector_backend='mtcnn',
                    enforce_detection=False
                )
                if result['verified'] and result['distance'] < best_distance:
                    best_distance = result['distance']
                    best_match = kf.person_id
            except Exception:
                continue

        return best_match

    except Exception as e:
        print(f"[recognize_face] error: {e}")
        return None


def get_face_full_path(face: Face) -> str:
    """Helper: returns absolute path to the face image on disk."""
    if face.face_path and os.path.exists(face.face_path):
        return face.face_path
    return os.path.join(FACES_DIR, face.face_filename)
