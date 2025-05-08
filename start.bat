@echo off
echo Starting Backend Servers...

rem Start Express Backend (for chat history)
start cmd /k "cd Backend && npm run dev"

rem Start FastAPI Backend (for AI responses)
start cmd /k "python main.py"

echo Started backend servers. Frontend can be started with:
echo cd Frontend/frontend && npm run dev
pause 