from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from models import db
import os

load_dotenv()

app = Flask(__name__)

# Allow all origins in dev; in prod use nginx and set specific origins
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ── Config ────────────────────────────────────────────────────────────────────
database_url = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_DATABASE_URI'] = (
    database_url if database_url else 'sqlite:///drishyamitra.db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'changeme_jwt_secret_32chars_long!')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'changeme_secret_key_here!')
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'data', 'photos')
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024   # 32 MB
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400         # 24 h

# ── Extensions ────────────────────────────────────────────────────────────────
db.init_app(app)
jwt = JWTManager(app)

# ── Blueprints ────────────────────────────────────────────────────────────────
from routes.auth import auth_bp
from routes.photos import photos_bp
from routes.faces import faces_bp
from routes.chatbot import chatbot_bp
from routes.albums import albums_bp

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(photos_bp, url_prefix='/api/photos')
app.register_blueprint(faces_bp, url_prefix='/api/faces')
app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')
app.register_blueprint(albums_bp, url_prefix='/api/albums')

# ── DB init ───────────────────────────────────────────────────────────────────
with app.app_context():
    db.create_all()
    print("✅ Database tables created/verified.")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
