from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Photo, Face, Person
from werkzeug.utils import secure_filename
import os
import uuid

photos_bp = Blueprint('photos', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ── UPLOAD PHOTO ──────────────────────────────────────────────────────────────
@photos_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_photo():
    user_id = get_jwt_identity()

    if 'photo' not in request.files:
        return jsonify({'message': 'No photo provided'}), 400

    file = request.files['photo']

    if not file or file.filename == '':
        return jsonify({'message': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'message': 'File type not allowed. Use JPG/PNG/WEBP/GIF.'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}.{ext}"

    upload_folder = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_folder, exist_ok=True)
    filepath = os.path.join(upload_folder, unique_filename)
    file.save(filepath)

    new_photo = Photo(
        filename=unique_filename,
        filepath=filepath,
        original_filename=secure_filename(file.filename),
        user_id=user_id
    )
    db.session.add(new_photo)
    db.session.commit()

    return jsonify({
        'message': 'Photo uploaded successfully!',
        'photo_id': new_photo.id,
        'filename': unique_filename
    }), 201


# ── GET ALL PHOTOS ────────────────────────────────────────────────────────────
@photos_bp.route('/all', methods=['GET'])
@jwt_required()
def get_all_photos():
    user_id = get_jwt_identity()
    photos = Photo.query.filter_by(user_id=user_id).order_by(Photo.uploaded_at.desc()).all()

    result = []
    for photo in photos:
        result.append({
            'id': photo.id,
            'filename': photo.filename,
            'original_filename': photo.original_filename,
            'description': photo.description,
            'tags': photo.get_tags_list(),
            'uploaded_at': photo.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return jsonify({'photos': result}), 200


# ── GET PHOTOS BY PERSON ──────────────────────────────────────────────────────
@photos_bp.route('/by-person/<int:person_id>', methods=['GET'])
@jwt_required()
def get_photos_by_person(person_id):
    faces = Face.query.filter_by(person_id=person_id).all()
    photo_ids = list(set(face.photo_id for face in faces))
    photos = Photo.query.filter(Photo.id.in_(photo_ids)).order_by(Photo.uploaded_at.desc()).all()

    result = [{
        'id': photo.id,
        'filename': photo.filename,
        'original_filename': photo.original_filename,
        'tags': photo.get_tags_list(),
        'uploaded_at': photo.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')
    } for photo in photos]

    return jsonify({'photos': result}), 200


# ── DELETE PHOTO ──────────────────────────────────────────────────────────────
@photos_bp.route('/delete/<int:photo_id>', methods=['DELETE'])
@jwt_required()
def delete_photo(photo_id):
    user_id = get_jwt_identity()
    photo = Photo.query.filter_by(id=photo_id, user_id=user_id).first()

    if not photo:
        return jsonify({'message': 'Photo not found'}), 404

    # Remove face crops from disk
    faces = Face.query.filter_by(photo_id=photo.id).all()
    for face in faces:
        face_path = face.face_path or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 'data', 'faces', face.face_filename
        )
        if face_path and os.path.exists(face_path):
            try:
                os.remove(face_path)
            except Exception:
                pass

    Face.query.filter_by(photo_id=photo.id).delete()

    # Remove from albums
    from models import AlbumPhoto
    AlbumPhoto.query.filter_by(photo_id=photo.id).delete()

    # Remove photo file
    if os.path.exists(photo.filepath):
        try:
            os.remove(photo.filepath)
        except Exception:
            pass

    db.session.delete(photo)
    db.session.commit()

    return jsonify({'message': 'Photo deleted successfully!'}), 200


# ── SERVE PHOTO FILE ──────────────────────────────────────────────────────────
@photos_bp.route('/serve/<filename>', methods=['GET'])
def serve_photo(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)


# ── SEARCH PHOTOS ─────────────────────────────────────────────────────────────
@photos_bp.route('/search', methods=['GET'])
@jwt_required()
def search_photos():
    user_id = get_jwt_identity()
    query = request.args.get('q', '').strip()
    date_filter = request.args.get('date', '').strip()
    tag_filter = request.args.get('tag', '').strip()

    photos_q = Photo.query.filter_by(user_id=user_id)

    if date_filter:
        from datetime import datetime
        try:
            filter_date = datetime.strptime(date_filter, '%Y-%m-%d').date()
            photos_q = photos_q.filter(db.func.date(Photo.uploaded_at) == filter_date)
        except ValueError:
            pass

    if tag_filter:
        photos_q = photos_q.filter(Photo.tags.ilike(f'%{tag_filter}%'))

    photos = photos_q.order_by(Photo.uploaded_at.desc()).all()

    result = []
    for photo in photos:
        if query:
            faces = Face.query.filter_by(photo_id=photo.id).all()
            person_ids = [f.person_id for f in faces if f.person_id]
            people = Person.query.filter(
                Person.id.in_(person_ids),
                Person.name.ilike(f'%{query}%')
            ).all()
            if not people:
                continue
        result.append({
            'id': photo.id,
            'filename': photo.filename,
            'original_filename': photo.original_filename,
            'tags': photo.get_tags_list(),
            'description': photo.description,
            'uploaded_at': photo.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return jsonify({'photos': result, 'count': len(result)}), 200
