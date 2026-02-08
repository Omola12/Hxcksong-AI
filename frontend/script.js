// Configuration
const CONFIG = {
    apiUrl: 'http://localhost:8000',
    defaultModel: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 500,
    enableStreaming: true
};

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const modelSelect = document.getElementById('modelSelect');
const clearChatBtn = document.getElementById('clearChat');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');
const streamToggle = document.getElementById('streamToggle');
const typingIndicator = document.getElementById('typingIndicator');
const tokenCountElement = document.getElementById('tokenCount');

// State
let messages = [];
let isGenerating = false;

// Initialize
function init() {
    loadSettings();
    setWelcomeTime();
    setupEventListeners();
    loadChatHistory();
    
    // Auto-resize textarea
    autoResizeTextarea();
}

function setWelcomeTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('welcome-time').textContent = timeString;
}

function setupEventListeners() {
    // Send message
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Textarea auto-resize
    userInput.addEventListener('input', autoResizeTextarea);

    // Clear chat
    clearChatBtn.addEventListener('click', () => {
        if (confirm('Clear all chat history?')) {
            clearChat();
        }
    });

    // Settings
    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
    closeSettings.addEventListener('click', () => settingsModal.style.display = 'none');
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    // Save settings
    saveSettings.addEventListener('click', saveSettingsHandler);

    // Update slider values
    document.getElementById('temperature').addEventListener('input', (e) => {
        document.getElementById('tempValue').textContent = e.target.value;
    });
    document.getElementById('maxTokens').addEventListener('input', (e) => {
        document.getElementById('tokenValue').textContent = e.target.value;
    });
}

function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
}

function addMessage(role, content) {
    const timestamp = new Date();
    const message = {
        role,
        content,
        timestamp: timestamp.toISOString()
    };
    
    messages.push(message);
    renderMessage(message);
    updateTokenCount();
    saveChatHistory();
    scrollToBottom();
}

function renderMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const avatarIcon = message.role === 'user' ? 'fas fa-user' : 'fas fa-robot';
    const avatarBg = message.role === 'user' ? 
        'background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);' : 
        'background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);';
    
    messageDiv.innerHTML = `
        <div class="avatar" style="${avatarBg}">
            <i class="${avatarIcon}"></i>
        </div>
        <div class="content">
            <div class="text">${escapeHtml(message.content)}</div>
            <div class="timestamp">${time}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
}

async function sendMessage() {
    const content = userInput.value.trim();
    if (!content || isGenerating) return;
    
    // Add user message
    addMessage('user', content);
    userInput.value = '';
    autoResizeTextarea();
    userInput.focus();
    
    isGenerating = true;
    sendButton.disabled = true;
    typingIndicator.style.display = 'flex';
    
    try {
        const requestData = {
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            model: modelSelect.value,
            temperature: CONFIG.temperature,
            max_tokens: CONFIG.maxTokens
        };
        
        if (CONFIG.enableStreaming && streamToggle.checked) {
            await streamResponse(requestData);
        } else {
            await regularResponse(requestData);
        }
    } catch (error) {
        console.error('Error:', error);
        addMessage('assistant', `Error: ${error.message}. Please check if the backend server is running.`);
    } finally {
        isGenerating = false;
        sendButton.disabled = false;
        typingIndicator.style.display = 'none';
    }
}

async function regularResponse(requestData) {
    const response = await fetch(`${CONFIG.apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    addMessage(data.message.role, data.message.content);
    
    // Update token count if provided
    if (data.usage) {
        updateTokenCount(data.usage.total_tokens);
    }
}

async function streamResponse(requestData) {
    const response = await fetch(`${CONFIG.apiUrl}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiMessage = '';
    
    // Create placeholder for streaming message
    const message = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString()
    };
    messages.push(message);
    renderMessage(message);
    
    const messageElements = document.querySelectorAll('.message');
    const lastMessage = messageElements[messageElements.length - 1];
    const textElement = lastMessage.querySelector('.text');
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        message.content = aiMessage;
                        saveChatHistory();
                        updateTokenCount();
                        return;
                    }
                    
                    aiMessage += data;
                    textElement.innerHTML = escapeHtml(aiMessage);
                    scrollToBottom();
                }
            }
        }
    } catch (error) {
        console.error('Streaming error:', error);
        textElement.innerHTML = escapeHtml(aiMessage + ' [Stream interrupted]');
    }
    
    message.content = aiMessage;
    saveChatHistory();
    updateTokenCount();
}

function clearChat() {
    messages = [];
    chatMessages.innerHTML = `
        <div class="message ai">
            <div class="avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="content">
                <div class="text">
                    Hello! I'm your AI assistant. How can I help you today?
                </div>
                <div class="timestamp" id="welcome-time"></div>
            </div>
        </div>
    `;
    setWelcomeTime();
    updateTokenCount();
    saveChatHistory();
}

function updateTokenCount(estimatedTokens = null) {
    if (estimatedTokens) {
        tokenCountElement.textContent = estimatedTokens;
        return;
    }
    
    // Simple estimation (4 chars ≈ 1 token)
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    const estimated = Math.ceil(totalChars / 4);
    tokenCountElement.textContent = estimated;
}

function loadSettings() {
    const saved = localStorage.getItem('aiChatSettings');
    if (saved) {
        Object.assign(CONFIG, JSON.parse(saved));
    }
    
    // Update UI with loaded settings
    document.getElementById('temperature').value = CONFIG.temperature;
    document.getElementById('maxTokens').value = CONFIG.maxTokens;
    document.getElementById('apiUrl').value = CONFIG.apiUrl;
    streamToggle.checked = CONFIG.enableStreaming;
    
    // Update displayed values
    document.getElementById('tempValue').textContent = CONFIG.temperature;
    document.getElementById('tokenValue').textContent = CONFIG.maxTokens;
    
    // Set model select if available
    if (CONFIG.defaultModel) {
        modelSelect.value = CONFIG.defaultModel;
    }
}

function saveSettingsHandler() {
    CONFIG.temperature = parseFloat(document.getElementById('temperature').value);
    CONFIG.maxTokens = parseInt(document.getElementById('maxTokens').value);
    CONFIG.apiUrl = document.getElementById('apiUrl').value;
    CONFIG.enableStreaming = streamToggle.checked;
    
    localStorage.setItem('aiChatSettings', JSON.stringify(CONFIG));
    settingsModal.style.display = 'none';
    
    alert('Settings saved successfully!');
}

function saveChatHistory() {
    localStorage.setItem('aiChatHistory', JSON.stringify(messages));
}

function loadChatHistory() {
    const saved = localStorage.getItem('aiChatHistory');
    if (saved) {
        messages = JSON.parse(saved);
        chatMessages.innerHTML = '';
        messages.forEach(msg => renderMessage(msg));
        updateTokenCount();
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize app
document.addEventListener('DOMContentLoaded', init);
