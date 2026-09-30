# ThirdEye Start Script

Write-Output "Starting ThirdEye Platform..."

# Start Backend
Write-Output "Starting FastAPI Backend on port 8000..."
Start-Process -FilePath "py" -ArgumentList "-m uvicorn app.main:app --reload --port 8000" -WorkingDirectory "apps\api" -NoNewWindow

# Start Frontend
Write-Output "Starting Next.js Frontend on port 3000..."
Start-Process -FilePath "npm" -ArgumentList "run dev --workspaces" -NoNewWindow

Write-Output "All services started! UI is at http://localhost:3000 and API is at http://localhost:8000"
