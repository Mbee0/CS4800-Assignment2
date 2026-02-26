from flask import Flask, jsonify, request, render_template
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
import os
from datetime import datetime

from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "myapp")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "recipes")

if not MONGO_URI:
    raise RuntimeError("Missing MONGO_URI. Create backend/.env with your MongoDB Atlas connection string.")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
recipes_col = db[COLLECTION_NAME]

# Frontend lives in ../frontend
app = Flask(
    __name__,
    template_folder="../frontend",
    static_folder="../frontend",
    static_url_path=""
)

def recipe_doc_to_json(doc):
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "description": doc.get("description", ""),
        "durationMinutes": int(doc.get("durationMinutes", 0)),
        "ingredients": doc.get("ingredients", []),
        "steps": doc.get("steps", []),
        "starred": bool(doc.get("starred", False)),  # ✅ add this
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }

@app.get("/")
def home():
    return render_template("index.html")

@app.get("/api/recipes")
def get_recipes():
    docs = recipes_col.find().sort("updatedAt", -1)
    recipes = [recipe_doc_to_json(d) for d in docs]
    return jsonify(recipes), 200

@app.get("/api/recipes/<recipe_id>")
def get_recipe(recipe_id):
    try:
        oid = ObjectId(recipe_id)
    except Exception:
        return jsonify({"error": "invalid id"}), 400

    doc = recipes_col.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "not found"}), 404
    return jsonify(recipe_doc_to_json(doc)), 200

@app.post("/api/recipes")
def create_recipe():
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    duration_minutes = data.get("durationMinutes", 0)
    ingredients = data.get("ingredients") or []
    steps = data.get("steps") or []
    starred = bool(data.get("starred", False))

    if not name:
        return jsonify({"error": "name is required"}), 400

    try:
        duration_minutes = int(duration_minutes)
        if duration_minutes < 0:
            duration_minutes = 0
    except Exception:
        duration_minutes = 0

    # Clean lists
    ingredients = [str(x).strip() for x in ingredients if str(x).strip()]
    steps = [str(x).strip() for x in steps if str(x).strip()]

    now = datetime.utcnow().isoformat() + "Z"

    doc = {
        "name": name,
        "description": description,
        "durationMinutes": duration_minutes,
        "ingredients": ingredients,
        "steps": steps,
        "createdAt": now,
        "updatedAt": now,
        "starred": starred,
    }

    result = recipes_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify(recipe_doc_to_json(doc)), 201

@app.put("/api/recipes/<recipe_id>")
def update_recipe(recipe_id):
    try:
        oid = ObjectId(recipe_id)
    except Exception:
        return jsonify({"error": "invalid id"}), 400

    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    duration_minutes = data.get("durationMinutes", 0)
    ingredients = data.get("ingredients") or []
    steps = data.get("steps") or []
    starred = bool(data.get("starred", False))

    if not name:
        return jsonify({"error": "name is required"}), 400

    try:
        duration_minutes = int(duration_minutes)
        if duration_minutes < 0:
            duration_minutes = 0
    except Exception:
        duration_minutes = 0

    ingredients = [str(x).strip() for x in ingredients if str(x).strip()]
    steps = [str(x).strip() for x in steps if str(x).strip()]

    now = datetime.utcnow().isoformat() + "Z"

    update = {
        "$set": {
            "name": name,
            "description": description,
            "durationMinutes": duration_minutes,
            "ingredients": ingredients,
            "steps": steps,
            "updatedAt": now,
            "starred": starred,
        }
    }

    res = recipes_col.update_one({"_id": oid}, update)
    if res.matched_count == 0:
        return jsonify({"error": "not found"}), 404

    doc = recipes_col.find_one({"_id": oid})
    return jsonify(recipe_doc_to_json(doc)), 200

@app.patch("/api/recipes/<recipe_id>/star")
def toggle_star(recipe_id):
    try:
        oid = ObjectId(recipe_id)
    except Exception:
        return jsonify({"error": "invalid id"}), 400

    data = request.get_json(silent=True) or {}
    starred = bool(data.get("starred", False))

    res = recipes_col.update_one({"_id": oid}, {"$set": {"starred": starred}})
    if res.matched_count == 0:
        return jsonify({"error": "not found"}), 404

    doc = recipes_col.find_one({"_id": oid})
    return jsonify(recipe_doc_to_json(doc)), 200

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=80)