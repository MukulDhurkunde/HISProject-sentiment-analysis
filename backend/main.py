from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import subprocess
import json
import os
import tempfile

app = FastAPI(title="Sentiment Analysis Preprocessing API")

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/api/preprocess")
async def preprocess_data(request: PreprocessRequest):
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
        
        # Call Rscript
        # We assume Rscript is in the system PATH.
        result = subprocess.run(
            ["Rscript", r_script_path, infile_path, outfile_path],
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        if result.returncode != 0:
            print("R Script Error Output:", result.stderr)
            raise HTTPException(status_code=500, detail=f"R script failed: {result.stderr}")
            
        # Read the output
        with open(outfile_path, 'r', encoding='utf-8') as outf:
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
