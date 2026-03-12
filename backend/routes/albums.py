"""
Album routes — create/read/update/delete albums independently,
add/remove photos, set cover, filter by tags.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Album, AlbumPhoto, Photo
from datetime import datetime

albums_bp = Blueprint('albums', __name__)


# ── LIST ALL ALBUMS ──────────────────────────────────────────────────────────
@albums_bp.route('/', methods=['GET'])
@jwt_required()
def list_albums():
    user_id = get_jwt_identity()
    albums = Album.query.filter_by(user_id=user_id).order_by(Album.created_at.desc()).all()

    result = []
    for album in albums:
        photo_count = AlbumPhoto.query.filter_by(album_id=album.id).count()

        # Cover photo filename
        cover_filename = None
        if album.cover_photo_id:
            cover = Photo.query.get(album.cover_photo_id)
            cover_filename = cover.filename if cover else None
        elif photo_count > 0:
            # Auto-pick first photo as cover
            first = (AlbumPhoto.query
                     .filter_by(album_id=album.id)
                     .order_by(AlbumPhoto.added_at)
                     .first())
            if first:
                ph = Photo.query.get(first.photo_id)
                cover_filename = ph.filename if ph else None

        result.append({
            'id': album.id,
            'name': album.name,
            'description': album.description,
            'photo_count': photo_count,
            'cover_filename': cover_filename,
            'created_at': album.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return jsonify({'albums': result}), 200


# ── CREATE ALBUM ─────────────────────────────────────────────────────────────
@albums_bp.route('/create', methods=['POST'])
@jwt_required()
def create_album():
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data or not data.get('name'):
        return jsonify({'message': 'Album name is required'}), 400

    album = Album(
        name=data['name'].strip(),
        description=data.get('description', '').strip(),
        user_id=user_id
    )
    db.session.add(album)
    db.session.commit()

    return jsonify({'message': 'Album created!', 'album_id': album.id}), 201


# ── GET ALBUM DETAILS + PHOTOS ────────────────────────────────────────────────
@albums_bp.route('/<int:album_id>', methods=['GET'])
@jwt_required()
def get_album(album_id):
    user_id = get_jwt_identity()
    album = Album.query.filter_by(id=album_id, user_id=user_id).first()
    if not album:
        return jsonify({'message': 'Album not found'}), 404

    album_photos = (AlbumPhoto.query
                    .filter_by(album_id=album_id)
                    .order_by(AlbumPhoto.added_at.desc())
                    .all())

    photos = []
    for ap in album_photos:
        ph = Photo.query.get(ap.photo_id)
        if ph:
            photos.append({
                'id': ph.id,
                'filename': ph.filename,
                'original_filename': ph.original_filename,
                'description': ph.description,
                'tags': ph.get_tags_list(),
                'uploaded_at': ph.uploaded_at.strftime('%Y-%m-%d %H:%M:%S'),
                'added_to_album_at': ap.added_at.strftime('%Y-%m-%d %H:%M:%S')
            })

    return jsonify({
        'id': album.id,
        'name': album.name,
        'description': album.description,
        'created_at': album.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'photos': photos
    }), 200


# ── UPDATE ALBUM ─────────────────────────────────────────────────────────────
@albums_bp.route('/<int:album_id>', methods=['PUT'])
@jwt_required()
def update_album(album_id):
    user_id = get_jwt_identity()
    album = Album.query.filter_by(id=album_id, user_id=user_id).first()
    if not album:
        return jsonify({'message': 'Album not found'}), 404

    data = request.get_json()
    if data.get('name'):
        album.name = data['name'].strip()
    if 'description' in data:
        album.description = data['description'].strip()
    if data.get('cover_photo_id'):
        album.cover_photo_id = data['cover_photo_id']

    db.session.commit()
    return jsonify({'message': 'Album updated!'}), 200


# ── DELETE ALBUM ─────────────────────────────────────────────────────────────
@albums_bp.route('/<int:album_id>', methods=['DELETE'])
@jwt_required()
def delete_album(album_id):
    user_id = get_jwt_identity()
    album = Album.query.filter_by(id=album_id, user_id=user_id).first()
    if not album:
        return jsonify({'message': 'Album not found'}), 404

    db.session.delete(album)   # cascade deletes album_photos rows too
    db.session.commit()
    return jsonify({'message': f'Album "{album.name}" deleted.'}), 200


# ── ADD PHOTOS TO ALBUM ───────────────────────────────────────────────────────
@albums_bp.route('/<int:album_id>/add-photos', methods=['POST'])
@jwt_required()
def add_photos_to_album(album_id):
    user_id = get_jwt_identity()
    album = Album.query.filter_by(id=album_id, user_id=user_id).first()
    if not album:
        return jsonify({'message': 'Album not found'}), 404

    data = request.get_json()
    photo_ids = data.get('photo_ids', [])
    if not photo_ids:
        return jsonify({'message': 'photo_ids list is required'}), 400

    added = 0
    skipped = 0
    for pid in photo_ids:
        photo = Photo.query.filter_by(id=pid, user_id=user_id).first()
        if not photo:
            continue
        existing = AlbumPhoto.query.filter_by(album_id=album_id, photo_id=pid).first()
        if existing:
            skipped += 1
            continue
        ap = AlbumPhoto(album_id=album_id, photo_id=pid)
        db.session.add(ap)
        added += 1

    db.session.commit()
    return jsonify({'message': f'{added} photo(s) added, {skipped} already in album.'}), 200


# ── REMOVE PHOTO FROM ALBUM ───────────────────────────────────────────────────
@albums_bp.route('/<int:album_id>/remove-photo/<int:photo_id>', methods=['DELETE'])
@jwt_required()
def remove_photo_from_album(album_id, photo_id):
    user_id = get_jwt_identity()
    album = Album.query.filter_by(id=album_id, user_id=user_id).first()
    if not album:
        return jsonify({'message': 'Album not found'}), 404

    ap = AlbumPhoto.query.filter_by(album_id=album_id, photo_id=photo_id).first()
    if not ap:
        return jsonify({'message': 'Photo not in this album'}), 404

    db.session.delete(ap)
    db.session.commit()
    return jsonify({'message': 'Photo removed from album.'}), 200


# ── UPDATE PHOTO TAGS / DESCRIPTION ──────────────────────────────────────────
@albums_bp.route('/photo/<int:photo_id>/meta', methods=['PUT'])
@jwt_required()
def update_photo_meta(photo_id):
    """Update tags and description on a photo for independent categorisation."""
    user_id = get_jwt_identity()
    photo = Photo.query.filter_by(id=photo_id, user_id=user_id).first()
    if not photo:
        return jsonify({'message': 'Photo not found'}), 404

    data = request.get_json()
    if 'tags' in data:
        # Accept list or comma string
        tags = data['tags']
        if isinstance(tags, list):
            photo.tags = ', '.join(t.strip() for t in tags if t.strip())
        else:
            photo.tags = str(tags).strip()
    if 'description' in data:
        photo.description = data['description'].strip()

    db.session.commit()
    return jsonify({
        'message': 'Photo metadata updated!',
        'tags': photo.get_tags_list(),
        'description': photo.description
    }), 200


# ── SEARCH PHOTOS BY TAG ──────────────────────────────────────────────────────
@albums_bp.route('/photos/by-tag', methods=['GET'])
@jwt_required()
def photos_by_tag():
    user_id = get_jwt_identity()
    tag = request.args.get('tag', '').strip()
    if not tag:
        return jsonify({'message': 'tag parameter is required'}), 400

    photos = Photo.query.filter(
        Photo.user_id == user_id,
        Photo.tags.ilike(f'%{tag}%')
    ).all()

    result = [{
        'id': p.id,
        'filename': p.filename,
        'tags': p.get_tags_list(),
        'description': p.description,
        'uploaded_at': p.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')
    } for p in photos]

    return jsonify({'photos': result, 'count': len(result)}), 200
