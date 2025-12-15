import sys
import os
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Add current directory to path so we can import index.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import your existing logic
from index import get_changed_rows

app = FastAPI()

class ProcessRequest(BaseModel):
    file_path: str

@app.get("/health")
def health_check():
    """Simple heartbeat to let Electron know Python is ready."""
    return {"status": "alive"}

@app.post("/process-file")
def process_file_endpoint(request: ProcessRequest):
    """
    Receives a file path from Electron, runs your logic, 
    and returns the result.
    """
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        # We run your existing logic
        # Your logic modifies the file in-place (highlighting rows)
        result_df = get_changed_rows(request.file_path)
        
        # Determine status based on your return values
        changes_found = False
        if result_df is not None and not result_df.empty:
            changes_found = True
        
        return {
            "status": "success",
            "message": "Processing complete",
            "changes_found": changes_found,
            "processed_file": request.file_path
        }
    except Exception as e:
        # Capture any internal errors and send them to the UI
        print(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run the server on localhost port 8000
    # access_log=False keeps the console clean
    uvicorn.run(app, host="127.0.0.1", port=8000, access_log=True)