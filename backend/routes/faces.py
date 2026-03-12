from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Face, Person, Photo
import os

faces_bp = Blueprint('faces', __name__)

FACES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'faces')


# ── GET ALL PEOPLE ──────────────────────────────────────────────────────────
@faces_bp.route('/people', methods=['GET'])
@jwt_required()
def get_people():
    user_id = get_jwt_identity()
    people = Person.query.filter_by(user_id=user_id).all()

    result = []
    for person in people:
        faces = Face.query.filter_by(person_id=person.id).all()
        unique_photos = len(set(f.photo_id for f in faces))

        # Pick a representative face thumbnail (first available)
        thumb = None
        for f in faces:
            fname = f.face_filename or ''
            if fname:
                thumb = fname
                break

        result.append({
            'id': person.id,
            'name': person.name,
            'photo_count': unique_photos,
            'thumbnail': thumb,
            'created_at': person.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return jsonify({'people': result}), 200


# ── ADD PERSON ──────────────────────────────────────────────────────────────
@faces_bp.route('/people/add', methods=['POST'])
@jwt_required()
def add_person():
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data or not data.get('name'):
        return jsonify({'message': 'Name is required'}), 400

    existing = Person.query.filter_by(name=data['name'], user_id=user_id).first()
    if existing:
        return jsonify({'message': 'Person already exists', 'person_id': existing.id}), 200

    new_person = Person(name=data['name'].strip(), user_id=user_id)
    db.session.add(new_person)
    db.session.commit()

    return jsonify({
        'message': f"{new_person.name} added successfully!",
        'person_id': new_person.id
    }), 201


# ── DELETE PERSON ───────────────────────────────────────────────────────────
@faces_bp.route('/people/<int:person_id>', methods=['DELETE'])
@jwt_required()
def delete_person(person_id):
    user_id = get_jwt_identity()
    person = Person.query.filter_by(id=person_id, user_id=user_id).first()
    if not person:
        return jsonify({'message': 'Person not found'}), 404

    # Unlink faces (set person_id to null instead of deleting face crops)
    Face.query.filter_by(person_id=person_id).update({'person_id': None})
    db.session.delete(person)
    db.session.commit()
    return jsonify({'message': f'{person.name} removed.'}), 200


# ── LABEL A FACE ────────────────────────────────────────────────────────────
@faces_bp.route('/label', methods=['POST'])
@jwt_required()
def label_face():
    data = request.get_json()

    if not data or not data.get('face_id') or not data.get('person_id'):
        return jsonify({'message': 'face_id and person_id are required'}), 400

    face = Face.query.get(data['face_id'])
    if not face:
        return jsonify({'message': 'Face not found'}), 404

    face.person_id = data['person_id']
    db.session.commit()
    return jsonify({'message': 'Face labelled successfully!'}), 200


# ── DETECT FACES IN A PHOTO ─────────────────────────────────────────────────
@faces_bp.route('/detect/<int:photo_id>', methods=['POST'])
@jwt_required()
def detect_faces(photo_id):
    user_id = get_jwt_identity()

    photo = Photo.query.filter_by(id=photo_id, user_id=user_id).first()
    if not photo:
        return jsonify({'message': 'Photo not found'}), 404

    from services.deepface_service import detect_and_save_faces
    faces = detect_and_save_faces(photo.filepath, photo.id, user_id)

    auto_recognized = [f for f in faces if f['auto_recognized']]
    unknown = [f for f in faces if not f['auto_recognized']]

    return jsonify({
        'message': f'{len(faces)} face(s) detected. '
                   f'{len(auto_recognized)} auto-recognised, {len(unknown)} unknown.',
        'faces': faces,
        'auto_recognized_count': len(auto_recognized),
        'unknown_count': len(unknown)
    }), 200


# ── GET ALL FACES IN A PHOTO ─────────────────────────────────────────────────
@faces_bp.route('/in-photo/<int:photo_id>', methods=['GET'])
@jwt_required()
def get_faces_in_photo(photo_id):
    faces = Face.query.filter_by(photo_id=photo_id).all()

    result = []
    for face in faces:
        person_name = None
        if face.person_id:
            person = Person.query.get(face.person_id)
            person_name = person.name if person else None

        # FIXED: return face_filename directly — no encrypted path basename nonsense
        result.append({
            'id': face.id,
            'face_filename': face.face_filename,
            'person_id': face.person_id,
            'person_name': person_name,
            'confidence': face.confidence
        })

    return jsonify({'faces': result}), 200


# ── GET ALL UNLABELLED FACES ────────────────────────────────────────────────
@faces_bp.route('/unlabeled', methods=['GET'])
@jwt_required()
def get_unlabeled_faces():
    user_id = get_jwt_identity()

    user_photo_ids = [p.id for p in Photo.query.filter_by(user_id=user_id).all()]

    unlabeled = Face.query.filter(
        Face.photo_id.in_(user_photo_ids),
        Face.person_id.is_(None)
    ).all()

    result = []
    for face in unlabeled:
        result.append({
            'face_id': face.id,
            'photo_id': face.photo_id,
            # FIXED: use face_filename directly — it IS the correct filename
            'face_filename': face.face_filename
        })

    return jsonify({'unlabeled_faces': result, 'count': len(result)}), 200


# ── SERVE FACE IMAGE (no auth required — UUID acts as token) ────────────────
@faces_bp.route('/serve/<filename>', methods=['GET'])
def serve_face(filename):
    """Serve a cropped face image by its UUID filename."""
    # Sanitise: only allow .jpg / .png / .jpeg extensions
    allowed = {'jpg', 'jpeg', 'png', 'webp'}
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in allowed:
        return jsonify({'message': 'Not found'}), 404
    return send_from_directory(FACES_DIR, filename)
