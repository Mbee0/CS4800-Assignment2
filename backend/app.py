from flask import Flask, jsonify, request, render_template
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "myapp")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "items")

if not MONGO_URI:
    raise RuntimeError("Missing MONGO_URI. Create backend/.env with your MongoDB Atlas connection string.")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
items_col = db[COLLECTION_NAME]

# IMPORTANT: your index.html, styles.css, app.js are in ../frontend
app = Flask(
    __name__,
    template_folder="../frontend",
    static_folder="../frontend",
    static_url_path=""  # makes /styles.css and /app.js work
)

@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/items")
def get_items():
    items = []
    for doc in items_col.find().sort("_id", -1):
        items.append({
            "id": str(doc["_id"]),
            "text": doc.get("text", "")
        })
    return jsonify(items), 200


@app.post("/api/items")
def create_item():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "text is required"}), 400

    result = items_col.insert_one({"text": text})
    return jsonify({"id": str(result.inserted_id), "text": text}), 201


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)