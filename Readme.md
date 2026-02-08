# AI Chat Assistant 🤖

A fully functional AI chatbot with web interface, supporting both cloud AI services (OpenAI) and local LLMs (via Ollama).

## Features
- 💬 Real-time chat with streaming responses
- 🎨 Beautiful, responsive UI
- ⚙️ Adjustable parameters (temperature, token limits)
- 💾 Local chat history storage
- 🔄 Support for multiple AI models
- 🌐 Both regular and streaming response modes

## Quick Start

### 1. **Backend Setup**
```bash
# Navigate to backend folder
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Run the server
uvicorn main:app --reload --port 8000
