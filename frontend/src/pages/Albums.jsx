import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAlbums, createAlbum, deleteAlbum, updateAlbum,
  getAlbum, getAllPhotos, addPhotosToAlbum, removePhotoFromAlbum,
  updatePhotoMeta, getPhotosByTag,
  getPhotoUrl
} from "../api";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
.bg-mesh{position:fixed;inset:0;z-index:0;pointer-events:none}
.bg-mesh::before{content:'';position:absolute;width:700px;height:700px;background:radial-gradient(circle,rgba(245,158,11,0.1) 0%,transparent 70%);top:-200px;left:-200px;animation:drift1 12s ease-in-out infinite alternate}
.bg-mesh::after{content:'';position:absolute;width:600px;height:600px;background:radial-gradient(circle,rgba(239,68,68,0.08) 0%,transparent 70%);bottom:-100px;right:-100px;animation:drift2 10s ease-in-out infinite alternate}
@keyframes drift1{from{transform:translate(0,0)}to{transform:translate(80px,60px)}}
@keyframes drift2{from{transform:translate(0,0)}to{transform:translate(-60px,-40px)}}
.glass{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px)}
.grad-btn{border:none;color:white;cursor:pointer;transition:all 0.3s;font-family:'Sora',sans-serif;font-weight:600}
.grad-btn:hover{transform:translateY(-2px);opacity:0.9}
.album-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;cursor:pointer;transition:all 0.3s}
.album-card:hover{transform:translateY(-4px);border-color:rgba(245,158,11,0.4);box-shadow:0 15px 30px rgba(0,0,0,0.4)}
.photo-card{position:relative;border-radius:12px;overflow:hidden;aspect-ratio:1;cursor:pointer;transition:all 0.3s}
.photo-card:hover{transform:scale(1.04);z-index:2}
.photo-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.8),transparent 50%);opacity:0;transition:opacity 0.3s;display:flex;flex-direction:column;justify-content:flex-end;padding:8px}
.photo-card:hover .photo-overlay{opacity:1}
.input-field{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:white;font-family:'Sora',sans-serif;padding:12px 16px;font-size:14px;outline:none;transition:all 0.3s;width:100%}
.input-field:focus{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,0.15)}
.input-field::placeholder{color:rgba(255,255,255,0.25)}
.tag-chip{background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;border-radius:100px;padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s}
.tag-chip:hover{background:rgba(245,158,11,0.3)}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
.modal{background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:28px;max-width:700px;width:100%;max-height:85vh;overflow-y:auto}
.fade-in{animation:fadeIn 0.4s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.checkbox-photo{position:relative;border-radius:10px;overflow:hidden;aspect-ratio:1;cursor:pointer;border:2px solid transparent;transition:all 0.2s}
.checkbox-photo.selected{border-color:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,0.4)}
`;

// ── Tab: Album Grid ───────────────────────────────────────────────────────────
function AlbumGrid({ albums, onOpen, onDelete, onCreateClick }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>
          🗂️ My Albums
          <span style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontSize: '11px', padding: '3px 10px', borderRadius: '100px', marginLeft: '8px' }}>{albums.length}</span>
        </h2>
        <button onClick={onCreateClick} className="grad-btn px-5 py-2 rounded-full text-sm" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>+ New Album</button>
      </div>

      {albums.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗂️</div>
          <p style={{ color: '#6b7280', fontSize: '16px', marginBottom: '16px' }}>No albums yet. Create your first album to organise your photos!</p>
          <button onClick={onCreateClick} className="grad-btn px-6 py-3 rounded-xl text-sm" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>Create Album</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {albums.map((album) => (
            <div key={album.id} className="album-card" onClick={() => onOpen(album)}>
              {/* Cover */}
              <div style={{ height: '150px', overflow: 'hidden', background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.1))' }}>
                {album.cover_filename
                  ? <img src={getPhotoUrl(album.cover_filename)} alt={album.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>📁</div>}
              </div>
              {/* Info */}
              <div style={{ padding: '14px' }}>
                <p style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{album.name}</p>
                {album.description && <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.description}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>📸 {album.photo_count} photos</span>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(album); }}
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', fontFamily: "'Sora',sans-serif" }}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Tag Explorer ────────────────────────────────────────────────────────
function TagExplorer() {
  const [tag, setTag] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!tag.trim()) return;
    setSearching(true);
    try {
      const res = await getPhotosByTag(tag.trim());
      setResults(res.data.photos || []);
    } catch { setResults([]); }
    setSearching(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>🏷️ Browse by Tag</h2>
      <div className="glass rounded-2xl p-4 mb-6 flex gap-3">
        <input type="text" value={tag} onChange={(e) => setTag(e.target.value)}
          onKeyPress={(e) => { if (e.key === 'Enter') search(); }}
          placeholder="Enter tag (e.g. Vacation, Birthday, Family)" className="input-field" style={{ flex: 1 }} />
        <button onClick={search} disabled={searching} className="grad-btn px-5 py-2 rounded-xl text-sm" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
          {searching ? 'Searching...' : '🔍 Search'}
        </button>
      </div>

      {results !== null && (
        <div>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
            {results.length} photo(s) tagged <strong style={{ color: '#f59e0b' }}>#{tag}</strong>
          </p>
          {results.length === 0
            ? <div className="glass rounded-2xl p-8 text-center"><p style={{ color: '#6b7280' }}>No photos found with this tag.</p></div>
            : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {results.map((photo) => (
                  <div key={photo.id} className="photo-card glass">
                    <img src={getPhotoUrl(photo.filename)} alt={photo.filename}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }} />
                    <div className="photo-overlay">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {photo.tags?.map((t) => <span key={t} className="tag-chip">{t}</span>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ── Main Albums Page ──────────────────────────────────────────────────────────
export default function Albums() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('albums');
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Album detail modal
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [albumDetail, setAlbumDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Add photos modal
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [allPhotos, setAllPhotos] = useState([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [adding, setAdding] = useState(false);

  // Tag editor
  const [editingPhotoTags, setEditingPhotoTags] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const fetchAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAlbums();
      setAlbums(res.data.albums || []);
    } catch { setAlbums([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlbums(); }, [fetchAlbums]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await createAlbum({ name: createName.trim(), description: createDesc.trim() });
      setCreateName(''); setCreateDesc(''); setShowCreate(false);
      fetchAlbums();
    } catch (err) { alert(err.response?.data?.message || 'Failed to create album'); }
    setCreating(false);
  };

  const handleDelete = async (album) => {
    if (!window.confirm(`Delete album "${album.name}"? (Photos are NOT deleted.)`)) return;
    try { await deleteAlbum(album.id); fetchAlbums(); if (activeAlbum?.id === album.id) setActiveAlbum(null); }
    catch { alert('Failed to delete album'); }
  };

  const openAlbum = async (album) => {
    setActiveAlbum(album);
    setDetailLoading(true);
    try {
      const res = await getAlbum(album.id);
      setAlbumDetail(res.data);
    } catch { setAlbumDetail(null); }
    setDetailLoading(false);
  };

  const openAddPhotos = async () => {
    const res = await getAllPhotos();
    setAllPhotos(res.data.photos || []);
    setSelectedPhotoIds([]);
    setShowAddPhotos(true);
  };

  const toggleSelect = (id) => setSelectedPhotoIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );

  const handleAddPhotos = async () => {
    if (selectedPhotoIds.length === 0) return;
    setAdding(true);
    try {
      await addPhotosToAlbum(activeAlbum.id, selectedPhotoIds);
      setShowAddPhotos(false);
      openAlbum(activeAlbum);
    } catch { alert('Failed to add photos'); }
    setAdding(false);
  };

  const handleRemovePhoto = async (photoId) => {
    if (!window.confirm('Remove photo from album?')) return;
    try {
      await removePhotoFromAlbum(activeAlbum.id, photoId);
      openAlbum(activeAlbum);
    } catch { alert('Failed to remove photo'); }
  };

  const openTagEditor = (photo) => {
    setEditingPhotoTags(photo);
    setTagInput(Array.isArray(photo.tags) ? photo.tags.join(', ') : (photo.tags || ''));
    setDescInput(photo.description || '');
  };

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      await updatePhotoMeta(editingPhotoTags.id, {
        tags: tagInput.split(',').map((t) => t.trim()).filter(Boolean),
        description: descInput
      });
      setEditingPhotoTags(null);
      if (activeAlbum) openAlbum(activeAlbum);
    } catch { alert('Failed to save'); }
    setSavingMeta(false);
  };

  return (
    <div style={{ fontFamily: "'Sora', sans-serif" }} className="min-h-screen bg-gray-950 text-white">
      <style>{CSS}</style>
      <div className="bg-mesh" />

      {/* Navbar */}
      <nav className="glass sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🗂️</div>
          <span style={{ fontSize: '20px', fontWeight: '800', background: 'linear-gradient(135deg,#fff 0%,#f59e0b 60%,#ef4444 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Albums</span>
        </div>
        <button onClick={() => navigate("/dashboard")} style={{ padding: '8px 18px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: "'Sora',sans-serif", fontSize: '13px', fontWeight: '600' }}>← Dashboard</button>
      </nav>

      <div className="relative z-10 p-8 max-w-6xl mx-auto fade-in">

        {/* Tabs */}
        <div className="glass rounded-2xl p-1 mb-8 flex gap-1 max-w-sm">
          {[['albums', '🗂️ Albums'], ['tags', '🏷️ By Tag']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: '10px', borderRadius: '14px', border: 'none', cursor: 'pointer',
              fontFamily: "'Sora',sans-serif", fontWeight: '600', fontSize: '13px', transition: 'all 0.2s',
              background: tab === key ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'transparent',
              color: tab === key ? 'white' : '#9ca3af'
            }}>{label}</button>
          ))}
        </div>

        {tab === 'albums' && (
          loading ? <p style={{ color: '#6b7280' }}>Loading albums...</p>
            : <AlbumGrid albums={albums} onOpen={openAlbum} onDelete={handleDelete} onCreateClick={() => setShowCreate(true)} />
        )}

        {tab === 'tags' && <TagExplorer />}
      </div>

      {/* ── Create Album Modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <div className="modal-bg" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '20px' }}>📁 Create New Album</h3>
            <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="Album name (e.g. Family Trip 2024)" className="input-field" style={{ marginBottom: '12px' }} />
            <textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="Description (optional)" rows={3}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontFamily: "'Sora',sans-serif", padding: '12px 16px', fontSize: '14px', outline: 'none', width: '100%', resize: 'vertical', marginBottom: '16px' }} />
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={creating || !createName.trim()} className="grad-btn px-6 py-3 rounded-xl text-sm" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', flex: 1 }}>
                {creating ? 'Creating...' : '✅ Create Album'}
              </button>
              <button onClick={() => setShowCreate(false)} style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: "'Sora',sans-serif", fontWeight: '600' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Album Detail Modal ──────────────────────────────────────────────── */}
      {activeAlbum && (
        <div className="modal-bg" onClick={() => setActiveAlbum(null)}>
          <div className="modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>📁 {activeAlbum.name}</h3>
                {activeAlbum.description && <p style={{ fontSize: '13px', color: '#9ca3af' }}>{activeAlbum.description}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={openAddPhotos} className="grad-btn px-4 py-2 rounded-xl text-sm" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>+ Add Photos</button>
                <button onClick={() => setActiveAlbum(null)} style={{ padding: '8px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: "'Sora',sans-serif", fontWeight: '600' }}>✕ Close</button>
              </div>
            </div>

            {detailLoading ? <p style={{ color: '#6b7280' }}>Loading...</p>
              : !albumDetail || albumDetail.photos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <p>This album is empty. Click "+ Add Photos" to add some!</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {albumDetail.photos.map((photo) => (
                    <div key={photo.id} className="photo-card glass">
                      <img src={getPhotoUrl(photo.filename)} alt={photo.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; }} />
                      <div className="photo-overlay">
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          {photo.tags?.map((t) => <span key={t} className="tag-chip">{t}</span>)}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openTagEditor(photo)} style={{ background: 'rgba(245,158,11,0.8)', border: 'none', color: 'white', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Sora',sans-serif", fontWeight: '600' }}>🏷️ Tag</button>
                          <button onClick={() => handleRemovePhoto(photo.id)} style={{ background: 'rgba(239,68,68,0.8)', border: 'none', color: 'white', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontFamily: "'Sora',sans-serif", fontWeight: '600' }}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}

      {/* ── Add Photos Modal ────────────────────────────────────────────────── */}
      {showAddPhotos && (
        <div className="modal-bg" onClick={() => setShowAddPhotos(false)}>
          <div className="modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800' }}>📸 Select Photos to Add</h3>
              <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: '600' }}>{selectedPhotoIds.length} selected</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-5" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {allPhotos.map((photo) => {
                const sel = selectedPhotoIds.includes(photo.id);
                return (
                  <div key={photo.id} className={`checkbox-photo ${sel ? 'selected' : ''}`} onClick={() => toggleSelect(photo.id)}>
                    <img src={getPhotoUrl(photo.filename)} alt={photo.filename}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }} />
                    {sel && <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#f59e0b', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'white', fontWeight: '800' }}>✓</div>}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddPhotos} disabled={adding || selectedPhotoIds.length === 0} className="grad-btn px-6 py-3 rounded-xl text-sm" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', flex: 1 }}>
                {adding ? 'Adding...' : `Add ${selectedPhotoIds.length} Photo(s)`}
              </button>
              <button onClick={() => setShowAddPhotos(false)} style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: "'Sora',sans-serif", fontWeight: '600' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tag Editor Modal ────────────────────────────────────────────────── */}
      {editingPhotoTags && (
        <div className="modal-bg" onClick={() => setEditingPhotoTags(null)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '16px' }}>🏷️ Edit Tags & Description</h3>
            <img src={getPhotoUrl(editingPhotoTags.filename)} alt="" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px', marginBottom: '16px' }} onError={(e) => { e.target.style.display = 'none'; }} />
            <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '6px' }}>TAGS (comma-separated)</label>
            <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              placeholder="Vacation, Family, Birthday, 2024 ..." className="input-field" style={{ marginBottom: '12px' }} />
            {tagInput && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {tagInput.split(',').filter((t) => t.trim()).map((t) => (
                  <span key={t} className="tag-chip">#{t.trim()}</span>
                ))}
              </div>
            )}
            <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '6px' }}>DESCRIPTION</label>
            <textarea value={descInput} onChange={(e) => setDescInput(e.target.value)}
              placeholder="Optional description..." rows={3}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontFamily: "'Sora',sans-serif", padding: '12px 16px', fontSize: '14px', outline: 'none', width: '100%', resize: 'vertical', marginBottom: '16px' }} />
            <div className="flex gap-3">
              <button onClick={saveMeta} disabled={savingMeta} className="grad-btn px-6 py-3 rounded-xl text-sm" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', flex: 1 }}>
                {savingMeta ? 'Saving...' : '✅ Save Tags'}
              </button>
              <button onClick={() => setEditingPhotoTags(null)} style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: "'Sora',sans-serif", fontWeight: '600' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
