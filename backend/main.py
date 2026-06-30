from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import subprocess
import asyncio
import json
import os
import tempfile
import glob
import shutil

from auth import (
    LoginRequest,
    TokenResponse,
    UserInfo,
    authenticate_user,
    create_access_token,
    get_current_user,
)

app = FastAPI(title="Sentiment Analysis Preprocessing API")

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def find_rscript() -> str:
    """
    Find the Rscript executable on Windows.
    Searches in order:
      1. System PATH (via shutil.which)
      2. Common Windows installation directories under Program Files
    Returns the full path to Rscript.exe, or raises an error if not found.
    """
    # 1. Check if Rscript is already in PATH
    rscript_path = shutil.which("Rscript")
    if rscript_path:
        return rscript_path

    # 2. Search common R installation directories on Windows
    search_dirs = [
        os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"), "R"),
        os.path.join(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"), "R"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "R"),
    ]

    for base_dir in search_dirs:
        if not os.path.isdir(base_dir):
            continue
        # Look for R-x.x.x/bin/Rscript.exe or R-x.x.x/bin/x64/Rscript.exe
        pattern = os.path.join(base_dir, "R-*", "bin", "Rscript.exe")
        matches = sorted(glob.glob(pattern), reverse=True)  # Latest version first
        if matches:
            return matches[0]
        # Also check bin/x64 subdirectory
        pattern_x64 = os.path.join(base_dir, "R-*", "bin", "x64", "Rscript.exe")
        matches_x64 = sorted(glob.glob(pattern_x64), reverse=True)
        if matches_x64:
            return matches_x64[0]

    raise FileNotFoundError(
        "Rscript.exe was not found on this system. "
        "Please install R from https://cran.r-project.org/bin/windows/base/ "
        "and ensure it is either in your system PATH or installed in 'C:\\Program Files\\R\\'."
    )


# Discover Rscript path at startup
try:
    RSCRIPT_PATH = find_rscript()
    print(f"[OK] Found Rscript at: {RSCRIPT_PATH}")
except FileNotFoundError as e:
    RSCRIPT_PATH = None
    print(f"[WARNING] {e}")


class ConfigModel(BaseModel):
    lowercase: bool
    removeUrlsHtml: bool
    stopwords: bool
    punctuation: bool
    specialChars: bool
    numbers: bool

class PreprocessRequest(BaseModel):
    df_rows: List[Dict[str, Any]]
    columns: List[str]
    missing_strategy: str
    config: ConfigModel

class AnalysisRequest(BaseModel):
    df_rows: List[Dict[str, Any]]
    text_column: str
    lexicon: str
    sensitivity: float
    theme_count: int
    ml_model: Optional[str] = None
    label_column: Optional[str] = None


# ── Authentication Endpoints ─────────────────────────────────────────────────

@app.post("/api/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate user and return a JWT access token."""
    user = authenticate_user(request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    access_token = create_access_token(data={"sub": user["username"]})
    return TokenResponse(
        access_token=access_token,
        username=user["username"],
        role=user["role"],
    )


@app.get("/api/me")
async def get_me(current_user: UserInfo = Depends(get_current_user)):
    """Return the currently authenticated user's info."""
    return {"username": current_user.username, "role": current_user.role}


# ── Protected Data Endpoints ─────────────────────────────────────────────────

@app.post("/api/preprocess")
async def preprocess_data(
    request: PreprocessRequest,
    current_user: UserInfo = Depends(get_current_user),
):
    if not RSCRIPT_PATH:
        raise HTTPException(
            status_code=503,
            detail="R is not installed or Rscript.exe was not found. "
                   "Please install R from https://cran.r-project.org/bin/windows/base/ "
                   "and restart the backend server."
        )

    # Convert Pydantic model to dict
    payload = request.dict()
    
    # We will write the payload to a temporary JSON file,
    # pass it to Rscript, and read the output JSON file.
    
    try:
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json', encoding='utf-8') as infile:
            json.dump(payload, infile)
            infile_path = infile.name
            
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json', encoding='utf-8') as outfile:
            outfile_path = outfile.name

        # Paths
        base_dir = os.path.dirname(os.path.abspath(__file__))
        r_script_path = os.path.join(base_dir, "R", "run_preprocessing.R")
        
        # Run Rscript in a thread so the event loop stays free for other requests
        result = await asyncio.to_thread(
            subprocess.run,
            [RSCRIPT_PATH, r_script_path, infile_path, outfile_path],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )

        if result.returncode != 0:
            print("R Script Error Output:", result.stderr)
            raise HTTPException(status_code=500, detail=f"R script failed: {result.stderr}")
            
        # Read the output
        with open(outfile_path, 'r', encoding='utf-8', errors='replace') as outf:
            processed_data = json.load(outf)
            
        return processed_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup temporary files
        if 'infile_path' in locals() and os.path.exists(infile_path):
            os.remove(infile_path)
        if 'outfile_path' in locals() and os.path.exists(outfile_path):
            os.remove(outfile_path)

@app.post("/api/analyze")
async def analyze_data(
    request: AnalysisRequest,
    current_user: UserInfo = Depends(get_current_user),
):
    if not RSCRIPT_PATH:
        raise HTTPException(
            status_code=503,
            detail="R is not installed or Rscript.exe was not found."
        )

    payload = request.dict()
    
    try:
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json', encoding='utf-8') as infile:
            json.dump(payload, infile)
            infile_path = infile.name
            
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json', encoding='utf-8') as outfile:
            outfile_path = outfile.name

        base_dir = os.path.dirname(os.path.abspath(__file__))
        r_script_path = os.path.join(base_dir, "R", "run_analysis.R")
        
        result = await asyncio.to_thread(
            subprocess.run,
            [RSCRIPT_PATH, r_script_path, infile_path, outfile_path],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )

        if result.returncode != 0:
            print("R Script Error Output:", result.stderr)
            raise HTTPException(status_code=500, detail=f"R script failed: {result.stderr}")
            
        with open(outfile_path, 'r', encoding='utf-8', errors='replace') as outf:
            analyzed_data = json.load(outf)
            
        return analyzed_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'infile_path' in locals() and os.path.exists(infile_path):
            os.remove(infile_path)
        if 'outfile_path' in locals() and os.path.exists(outfile_path):
            os.remove(outfile_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
