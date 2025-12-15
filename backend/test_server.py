from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from server import app
import os

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}

@patch("server.get_changed_rows")
@patch("os.path.exists")
def test_process_file_success_changes_found(mock_exists, mock_get_changed_rows):
    mock_exists.return_value = True
    
    # Mocking a dataframe with some data
    mock_df = MagicMock()
    mock_df.empty = False
    mock_get_changed_rows.return_value = mock_df
    
    response = client.post("/process-file", json={"file_path": "test.xlsx"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["changes_found"] is True
    assert data["processed_file"] == "test.xlsx"

@patch("server.get_changed_rows")
@patch("os.path.exists")
def test_process_file_success_no_changes(mock_exists, mock_get_changed_rows):
    mock_exists.return_value = True
    
    # Mocking an empty dataframe or None
    mock_get_changed_rows.return_value = None
    
    response = client.post("/process-file", json={"file_path": "test.xlsx"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["changes_found"] is False

@patch("os.path.exists")
def test_process_file_not_found(mock_exists):
    mock_exists.return_value = False
    
    response = client.post("/process-file", json={"file_path": "missing.xlsx"})
    
    assert response.status_code == 404
    assert response.json()["detail"] == "File not found"

@patch("server.get_changed_rows")
@patch("os.path.exists")
def test_process_file_internal_error(mock_exists, mock_get_changed_rows):
    mock_exists.return_value = True
    mock_get_changed_rows.side_effect = Exception("Boom")
    
    response = client.post("/process-file", json={"file_path": "test.xlsx"})
    
    assert response.status_code == 500
    assert "Boom" in response.json()["detail"]
