import os

os.environ.setdefault('FLASK_ENV', 'production')

if __name__ == '__main__':
    print("🔮 Starting Drishyamitra Backend Server...")
    from app import app
    app.run(host='0.0.0.0', port=5000, debug=False)
