let currentUser = null;
let currentGroup = null;
let ws;

// Initialize WebSocket connection
function initWebSocket() {
    ws = new WebSocket('wss://' + window.location.hostname + ':8080');
    
    ws.onopen = function() {
        console.log('Connected to WebSocket server');
    };
    
    ws.onmessage = function(e) {
        const data = JSON.parse(e.data);
        if (data.group_id === currentGroup) {
            appendMessage(data);
        }
    };
    
    ws.onclose = function() {
        console.log('Disconnected from WebSocket server');
        // Try to reconnect in 5 seconds
        setTimeout(initWebSocket, 5000);
    };
}

// Update sendMessage function
function sendMessage() {
    if (!currentGroup) {
        alert('Please select a group first!');
        return;
    }

    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if(message && ws.readyState === WebSocket.OPEN) {
        const messageData = {
            group_id: currentGroup,
            message: message,
            username: currentUser,
            type: 'message'
        };
        
        ws.send(JSON.stringify(messageData));
        input.value = '';
    }
}

// Update the message append function
function appendMessage(data) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.username === currentUser ? 'sent' : 'received'}`;
    messageDiv.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
    messagesDiv.appendChild(messageDiv);
    
    const clear = document.createElement('div');
    clear.className = 'clear';
    messagesDiv.appendChild(clear);
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Initialize WebSocket when page loads
document.addEventListener('DOMContentLoaded', function() {
    initWebSocket();
});

// Initialize the page
fetch('api.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'action=check_auth'
})
.then(response => response.json())
.then(data => {
    if (data.authenticated) {
        currentUser = data.username;
        loadGroups();
    } else {
        window.location.href = 'login.html';
    }
});

// Modal functions
function showCreateGroupModal() {
    document.getElementById('create-group-modal').style.display = 'block';
}

function showJoinGroupModal() {
    document.getElementById('join-group-modal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Group functions
function createGroup() {
    const groupName = document.getElementById('group-name').value.trim();
    if (groupName) {
        fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=create_group&name=${encodeURIComponent(groupName)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(`Group created! Your group PIN is: ${data.pin}`);
                closeModal('create-group-modal');
                loadGroups();
            } else {
                alert(data.error || 'Failed to create group');
            }
        });
    }
}

function joinGroup() {
    const pin = document.getElementById('group-pin').value.trim();
    if (pin) {
        fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=join_group&pin=${encodeURIComponent(pin)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Successfully joined the group!');
                closeModal('join-group-modal');
                loadGroups();
            } else {
                alert(data.error || 'Failed to join group');
            }
        });
    }
}

function loadGroups() {
    fetch('api.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'action=get_groups'
    })
    .then(response => response.json())
    .then(data => {
        const groupList = document.getElementById('group-list');
        groupList.innerHTML = '';
        data.groups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'group-item';
            groupDiv.textContent = group.name;
            groupDiv.onclick = () => selectGroup(group.id, group.name);
            groupList.appendChild(groupDiv);
        });
    });
}

function selectGroup(groupId, groupName) {
    currentGroup = groupId;
    document.getElementById('current-group').textContent = groupName;
    fetchGroupMessages();
}

function fetchGroupMessages() {
    if (!currentGroup) return;
    
    fetch('api.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=get_group_messages&group_id=${currentGroup}`
    })
    .then(response => response.json())
    .then(data => {
        const messagesDiv = document.getElementById('messages');
        const previousHeight = messagesDiv.scrollHeight;
        messagesDiv.innerHTML = '';
        
        data.messages.forEach((msg, index) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.username === currentUser ? 'sent' : 'received'}`;
            messageDiv.style.animationDelay = `${index * 0.1}s`; // Stagger animation
            messageDiv.innerHTML = `<strong>${msg.username}:</strong> ${msg.message}`;
            messagesDiv.appendChild(messageDiv);
            
            const clear = document.createElement('div');
            clear.className = 'clear';
            messagesDiv.appendChild(clear);
        });
        
        // Only scroll if we're already at the bottom
        if (messagesDiv.scrollTop + messagesDiv.clientHeight >= previousHeight) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    });
}

// Update sendMessage function to handle group messages
function sendMessage() {
    if (!currentGroup) {
        alert('Please select a group first!');
        return;
    }

    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if(message) {
        fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=send&message=${encodeURIComponent(message)}&group_id=${currentGroup}`
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                input.value = '';
                fetchGroupMessages();
            } else {
                alert(data.error || 'Failed to send message');
            }
        });
    }
}

// Event listeners
document.getElementById('message-input').addEventListener('keypress', function(e) {
    if(e.key === 'Enter') {
        sendMessage();
    }
});

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = 'none';
    }
}

// Auto-refresh messages
setInterval(() => {
    if (currentGroup) {
        fetchGroupMessages();
    }
}, 3000);