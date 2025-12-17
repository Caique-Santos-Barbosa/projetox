from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import face_recognition
import numpy as np
import base64
import io
import os
import json
from PIL import Image
from datetime import datetime
import uuid

app = FastAPI(title="Face Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage paths
DATA_DIR = "data"
FACES_DIR = os.path.join(DATA_DIR, "faces")
USERS_FILE = os.path.join(DATA_DIR, "users.json")

os.makedirs(FACES_DIR, exist_ok=True)

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)

class UserCreate(BaseModel):
    name: str
    email: str
    department: Optional[str] = None

class VerifyRequest(BaseModel):
    image_base64: str

class LivenessCheck(BaseModel):
    images: list[str]  # Multiple frames for liveness

@app.get("/")
async def root():
    return {"status": "ok", "message": "Face Recognition API"}

@app.get("/api/users")
async def get_users():
    users = load_users()
    return {"users": list(users.values())}

@app.post("/api/users/register")
async def register_user(
    name: str,
    email: str,
    department: str = "",
    photo: UploadFile = File(...)
):
    users = load_users()
    
    # Check if email exists
    for user in users.values():
        if user["email"] == email:
            raise HTTPException(400, "Email já cadastrado")
    
    # Process face image
    contents = await photo.read()
    image = face_recognition.load_image_file(io.BytesIO(contents))
    encodings = face_recognition.face_encodings(image)
    
    if len(encodings) == 0:
        raise HTTPException(400, "Nenhum rosto detectado na imagem")
    
    if len(encodings) > 1:
        raise HTTPException(400, "Múltiplos rostos detectados. Use uma foto com apenas um rosto")
    
    user_id = str(uuid.uuid4())
    encoding = encodings[0].tolist()
    
    # Save photo
    photo_path = os.path.join(FACES_DIR, f"{user_id}.jpg")
    img = Image.open(io.BytesIO(contents))
    img.save(photo_path, "JPEG")
    
    # Save user
    users[user_id] = {
        "id": user_id,
        "name": name,
        "email": email,
        "department": department,
        "encoding": encoding,
        "photo_path": photo_path,
        "created_at": datetime.now().isoformat(),
        "access_granted": True
    }
    save_users(users)
    
    return {"success": True, "user_id": user_id, "message": "Usuário cadastrado com sucesso"}

@app.post("/api/verify")
async def verify_face(request: VerifyRequest):
    users = load_users()
    
    if not users:
        raise HTTPException(404, "Nenhum usuário cadastrado")
    
    # Decode base64 image
    try:
        image_data = base64.b64decode(request.image_base64)
        image = face_recognition.load_image_file(io.BytesIO(image_data))
    except Exception as e:
        raise HTTPException(400, f"Erro ao processar imagem: {str(e)}")
    
    # Get face encoding
    encodings = face_recognition.face_encodings(image)
    
    if len(encodings) == 0:
        return {"verified": False, "message": "Nenhum rosto detectado"}
    
    unknown_encoding = encodings[0]
    
    # Compare with all users
    for user_id, user in users.items():
        if not user.get("access_granted", True):
            continue
            
        known_encoding = np.array(user["encoding"])
        matches = face_recognition.compare_faces([known_encoding], unknown_encoding, tolerance=0.5)
        distance = face_recognition.face_distance([known_encoding], unknown_encoding)[0]
        
        if matches[0]:
            return {
                "verified": True,
                "user": {
                    "id": user["id"],
                    "name": user["name"],
                    "email": user["email"],
                    "department": user.get("department", "")
                },
                "confidence": round((1 - distance) * 100, 2),
                "message": f"Acesso liberado para {user['name']}"
            }
    
    return {"verified": False, "message": "Usuário não reconhecido"}

@app.post("/api/verify-liveness")
async def verify_with_liveness(request: LivenessCheck):
    """Verify face with liveness detection using multiple frames"""
    if len(request.images) < 3:
        raise HTTPException(400, "Mínimo de 3 frames necessários para verificação de vivacidade")
    
    users = load_users()
    if not users:
        raise HTTPException(404, "Nenhum usuário cadastrado")
    
    face_locations_list = []
    encodings_list = []
    
    # Process multiple frames
    for img_base64 in request.images:
        try:
            image_data = base64.b64decode(img_base64)
            image = face_recognition.load_image_file(io.BytesIO(image_data))
            locations = face_recognition.face_locations(image)
            
            if locations:
                face_locations_list.append(locations[0])
                encoding = face_recognition.face_encodings(image, locations)
                if encoding:
                    encodings_list.append(encoding[0])
        except:
            continue
    
    # Liveness check: verify face movement between frames
    if len(face_locations_list) < 3:
        return {"verified": False, "liveness": False, "message": "Não foi possível detectar movimento facial"}
    
    # Check for position variation (basic liveness)
    positions = [(loc[0] + loc[2], loc[1] + loc[3]) for loc in face_locations_list]
    variations = []
    for i in range(1, len(positions)):
        dx = abs(positions[i][0] - positions[i-1][0])
        dy = abs(positions[i][1] - positions[i-1][1])
        variations.append(dx + dy)
    
    avg_variation = sum(variations) / len(variations) if variations else 0
    
    # Require some movement but not too much (indicates real person)
    liveness_passed = 5 < avg_variation < 200
    
    if not liveness_passed:
        return {"verified": False, "liveness": False, "message": "Verificação de vivacidade falhou"}
    
    # Use last frame for verification
    if not encodings_list:
        return {"verified": False, "liveness": True, "message": "Nenhum rosto detectado para verificação"}
    
    unknown_encoding = encodings_list[-1]
    
    # Compare with users
    for user_id, user in users.items():
        if not user.get("access_granted", True):
            continue
            
        known_encoding = np.array(user["encoding"])
        matches = face_recognition.compare_faces([known_encoding], unknown_encoding, tolerance=0.5)
        distance = face_recognition.face_distance([known_encoding], unknown_encoding)[0]
        
        if matches[0]:
            return {
                "verified": True,
                "liveness": True,
                "user": {
                    "id": user["id"],
                    "name": user["name"],
                    "email": user["email"],
                    "department": user.get("department", "")
                },
                "confidence": round((1 - distance) * 100, 2),
                "message": f"Acesso liberado para {user['name']}"
            }
    
    return {"verified": False, "liveness": True, "message": "Usuário não reconhecido"}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str):
    users = load_users()
    if user_id not in users:
        raise HTTPException(404, "Usuário não encontrado")
    
    # Remove photo
    photo_path = users[user_id].get("photo_path")
    if photo_path and os.path.exists(photo_path):
        os.remove(photo_path)
    
    del users[user_id]
    save_users(users)
    
    return {"success": True, "message": "Usuário removido"}

@app.patch("/api/users/{user_id}/access")
async def toggle_access(user_id: str):
    users = load_users()
    if user_id not in users:
        raise HTTPException(404, "Usuário não encontrado")
    
    users[user_id]["access_granted"] = not users[user_id].get("access_granted", True)
    save_users(users)
    
    status = "liberado" if users[user_id]["access_granted"] else "bloqueado"
    return {"success": True, "message": f"Acesso {status}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

