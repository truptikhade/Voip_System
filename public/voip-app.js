// VoIP System - Advanced calling application (FIXED VERSION)
// Socket.io connection
const socket = io();

// Global State
let currentUser = null;
let currentPhoneNumber = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let currentCall = null;
let incomingCallData = null;
let statsInterval = null;
let callStartTime = null;
let callTimerInterval = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let isMuted = false;
let isHeld = false;
let callHistory = [];
let callQueue = [];
let voicemail = [];

// FIX #3 — Track call direction and name
let callDirection = null;
let currentCallName = null;

// FIX #5 — ICE candidate queue
let iceCandidateQueue = [];

// RTCPeerConnection configuration
const peerConnectionConfig = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['stun:stun1.l.google.com:19302'] }
    ]
};

// UI Elements
const loginSection = document.getElementById('loginSection');
const callSection = document.getElementById('callSection');
const usernameInput = document.getElementById('usernameInput');
const phoneNumberInput = document.getElementById('phoneNumberInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const currentUsernameSpan = document.getElementById('currentUsername');
const currentPhoneNumberSpan = document.getElementById('currentPhoneNumber');
const usersList = document.getElementById('usersList');
const remoteAudio = document.getElementById('remoteAudio');
const localAudio = document.getElementById('localAudio');
const callControls = document.getElementById('callControls');
const hangupBtn = document.getElementById('hangupBtn');
const muteBtn = document.getElementById('muteBtn');
const recordBtn = document.getElementById('recordBtn');
const transferBtn = document.getElementById('transferBtn');
const holdBtn = document.getElementById('holdBtn');
const incomingCallNotification = document.getElementById('incomingCallNotification');
const incomingCallerId = document.getElementById('incomingCallerId');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const voicemailBtn = document.getElementById('voicemailBtn');
const callStatus = document.getElementById('callStatus');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');
const callTimer = document.getElementById('callTimer');
const callQueue_ = document.getElementById('callQueue');
const voicemailList = document.getElementById('voicemailList');
const voicemailCount = document.getElementById('voicemailCount');
const callHistory_ = document.getElementById('callHistory');
const dialDisplay = document.getElementById('dialDisplay');
const transferModal = document.getElementById('transferModal');
const transferContacts = document.getElementById('transferContacts');

// Stats elements
const latencyStat = document.getElementById('latencyStat');
const packetLossStat = document.getElementById('packetLossStat');
const jitterStat = document.getElementById('jitterStat');
const bandwidthStat = document.getElementById('bandwidthStat');

// ─────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────

loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const phoneNumber = phoneNumberInput.value.trim() || `+1${Date.now().toString().slice(-10)}`;

    if (!username) {
        alert('Please enter your name');
        return;
    }

    await login(username, phoneNumber);
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', logout);

hangupBtn.addEventListener('click', endCall);
muteBtn.addEventListener('click', toggleMute);
recordBtn.addEventListener('click', toggleRecording);
transferBtn.addEventListener('click', initTransfer);
holdBtn.addEventListener('click', toggleHold);
acceptCallBtn.addEventListener('click', acceptCall);
rejectCallBtn.addEventListener('click', rejectCall);
voicemailBtn.addEventListener('click', sendToVoicemail);

// ─────────────────────────────────────────────
// Dial Pad
// ─────────────────────────────────────────────

function dialKey(digit) {
    dialDisplay.value += digit;
}

function clearDial() {
    dialDisplay.value = '';
}

function backspaceDial() {
    dialDisplay.value = dialDisplay.value.slice(0, -1);
}

function callFromDial() {
    const number = dialDisplay.value.trim();
    if (!number) {
        alert('Please enter a number');
        return;
    }

    const userToCall = Array.from(document.querySelectorAll('.user-item')).find(item =>
        item.textContent.includes(number)
    );

    if (userToCall) {
        const callBtn = userToCall.querySelector('.btn');
        callBtn.click();
    } else {
        alert('User not found');
    }

    dialDisplay.value = '';
}

// ─────────────────────────────────────────────
// Login / Logout
// ─────────────────────────────────────────────

async function login(username, phoneNumber) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        localAudio.srcObject = localStream;

        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        currentUser = { id: userId, name: username };
        currentPhoneNumber = phoneNumber;

        loadCallHistory();

        socket.emit('register', { userId, username, phoneNumber });

        currentUsernameSpan.textContent = username;
        currentPhoneNumberSpan.textContent = phoneNumber;
        loginSection.classList.remove('active');
        callSection.classList.add('active');

        console.log('✅ Logged in as', username);
    } catch (error) {
        console.error('❌ Error accessing microphone:', error);
        alert('Unable to access microphone. Please check permissions.');
    }
}

function logout() {
    if (currentCall) endCall();

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder = null;
    }

    currentUser = null;
    currentPhoneNumber = null;

    callSection.classList.remove('active');
    loginSection.classList.add('active');
    usernameInput.value = '';
    phoneNumberInput.value = '';
    usersList.innerHTML = '';
    callControls.classList.add('hidden');
    dialDisplay.value = '';

    console.log('👋 Logged out');
}

// ─────────────────────────────────────────────
// Socket.io Event Handlers
// ─────────────────────────────────────────────

socket.on('users-updated', (users) => {
    updateUsersList(users);
});

socket.on('incoming-call', async (data) => {
    const { callerId, offer } = data;
    incomingCallData = { callerId, offer, callerName: data.callerName };

    const callerName = data.callerName || callerId;
    incomingCallerId.textContent = callerName;
    incomingCallNotification.classList.remove('hidden');

    statusTitle.textContent = `Incoming call from ${callerName}`;
    console.log('📞 Incoming call from', callerId);
});

socket.on('call-answered', async (data) => {
    const { receiverId, answer } = data;

    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

        // FIX #5 — flush queued ICE candidates now that remote description is set
        await flushIceCandidateQueue();

        statusTitle.textContent = `Connected with ${receiverId}`;
        callStartTime = Date.now();
        startCallTimer();
        startStatsMonitoring();
        console.log('✅ Call answered');
    } catch (error) {
        console.error('❌ Error setting remote description:', error);
        endCall();
    }
});

socket.on('call-rejected', () => {
    statusTitle.textContent = 'Call was rejected';
    endCall();
});

socket.on('call-ended', () => {
    endCall();
});

// FIX #5 — Queue ICE candidates if remote description not set yet
socket.on('ice-candidate', async (data) => {
    const { candidate } = data;

    if (!peerConnection) return;

    if (!peerConnection.remoteDescription) {
        iceCandidateQueue.push(candidate);
        return;
    }

    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
});

socket.on('stats-updated', (data) => {
    if (data.callId === currentCall) {
        updateStatsDisplay(data.stats);
    }
});

socket.on('connect', () => {
    console.log('🔗 Connected to signaling server');
});

socket.on('disconnect', () => {
    console.log('🔌 Disconnected from signaling server');
    if (currentCall) endCall();
});

// ─────────────────────────────────────────────
// FIX #5 — Flush ICE candidate queue
// ─────────────────────────────────────────────

async function flushIceCandidateQueue() {
    while (iceCandidateQueue.length > 0) {
        const candidate = iceCandidateQueue.shift();
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('Queued ICE candidate error:', e);
        }
    }
}

// ─────────────────────────────────────────────
// Users List
// ─────────────────────────────────────────────

function updateUsersList(users) {
    usersList.innerHTML = '';

    const otherUsers = users.filter(user => user.userId !== currentUser?.id);

    if (otherUsers.length === 0) {
        usersList.innerHTML = '<p style="color: #999; text-align: center; padding: 10px;">No other users online</p>';
        return;
    }

    otherUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-details-info">
                <div class="user-name">${user.username}</div>
                <div style="font-size: 11px; color: #999;">${user.phoneNumber || 'N/A'}</div>
            </div>
            <button class="btn btn-success" style="padding: 6px 10px; font-size: 11px; margin: 0;"
                onclick="initiateCall('${user.userId}', '${user.username}')">
                📞
            </button>
        `;
        usersList.appendChild(userItem);
    });
}

// ─────────────────────────────────────────────
// Initiate Call
// ─────────────────────────────────────────────

async function initiateCall(receiverId, receiverName) {
    if (currentCall) {
        alert('You are already in a call');
        return;
    }

    try {
        statusTitle.textContent = `Calling ${receiverName}...`;
        incomingCallNotification.classList.add('hidden');

        // FIX #3 — track direction and name
        callDirection = 'outgoing';
        currentCallName = receiverName;

        peerConnection = new RTCPeerConnection(peerConnectionConfig);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            console.log('📡 Received remote stream');
            remoteStream = event.streams[0];
            remoteAudio.srcObject = remoteStream;
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    to: receiverId,
                    candidate: event.candidate
                });
            }
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log('✅ Peer connection established');
                statusTitle.textContent = `Connected with ${receiverName}`;
                callControls.classList.remove('hidden');
                callStartTime = Date.now();
                startCallTimer();
            } else if (peerConnection.connectionState === 'failed') {
                console.error('Connection failed');
                endCall();
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        currentCall = `${currentUser.id}-${receiverId}`;

        socket.emit('call-user', {
            callerId: currentUser.id,
            receiverId,
            offer
        });

    } catch (error) {
        console.error('❌ Error initiating call:', error);
        endCall();
    }
}

// ─────────────────────────────────────────────
// Accept Call
// ─────────────────────────────────────────────

async function acceptCall() {
    if (!incomingCallData) return;

    try {
        const { callerId, offer, callerName } = incomingCallData;
        incomingCallNotification.classList.add('hidden');
        statusTitle.textContent = 'Accepting call...';

        // FIX #3 — track direction and name
        callDirection = 'incoming';
        currentCallName = callerName || callerId;

        peerConnection = new RTCPeerConnection(peerConnectionConfig);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            console.log('📡 Received remote stream');
            remoteStream = event.streams[0];
            remoteAudio.srcObject = remoteStream;
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    to: callerId,
                    candidate: event.candidate
                });
            }
        };

        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'connected') {
                console.log('✅ Call connected');
                statusTitle.textContent = 'Connected';
                callStartTime = Date.now();
                startCallTimer();
            } else if (peerConnection.connectionState === 'failed') {
                endCall();
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // FIX #5 — flush queued ICE candidates after setting remote description
        await flushIceCandidateQueue();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        currentCall = `${callerId}-${currentUser.id}`;

        socket.emit('call-answer', {
            callerId,
            receiverId: currentUser.id,
            answer
        });

        callControls.classList.remove('hidden');

    } catch (error) {
        console.error('❌ Error accepting call:', error);
        endCall();
    }
}

// ─────────────────────────────────────────────
// Reject / Voicemail
// ─────────────────────────────────────────────

function rejectCall() {
    if (!incomingCallData) return;

    const { callerId } = incomingCallData;
    socket.emit('reject-call', { callerId });

    incomingCallNotification.classList.add('hidden');
    incomingCallData = null;

    console.log('❌ Call rejected');
}

function sendToVoicemail() {
    if (!incomingCallData) return;

    const { callerId } = incomingCallData;

    voicemail.push({
        from: callerId,
        timestamp: new Date(),
        duration: 0
    });

    rejectCall();
    updateVoicemailDisplay();
}

// ─────────────────────────────────────────────
// End Call
// ─────────────────────────────────────────────

function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }

    remoteAudio.srcObject = null;

    // FIX #7 — reset ICE queue between calls
    iceCandidateQueue = [];

    if (currentCall) {
        // FIX #4 — safe duration when callStartTime is null
        const duration = callStartTime
            ? Math.round((Date.now() - callStartTime) / 1000)
            : 0;

        // FIX #3 — save correct direction and name
        callHistory.push({
            type: callDirection || 'outgoing',
            timestamp: new Date(),
            duration,
            number: currentCallName || 'Unknown'
        });

        saveCallHistory();
        updateCallHistoryDisplay();

        socket.emit('end-call', {
            callId: currentCall,
            participants: [currentUser.id]
        });

        currentCall = null;
    }

    // FIX #3 — reset call meta
    callDirection = null;
    currentCallName = null;

    // FIX #4 — reset callStartTime
    callStartTime = null;

    callControls.classList.add('hidden');
    incomingCallNotification.classList.add('hidden');
    statusTitle.textContent = 'Ready to Call';
    statusMessage.textContent = '';

    stopCallTimer();
    stopStatsMonitoring();
    resetStats();

    if (isRecording) stopRecording();

    isMuted = false;
    isHeld = false;
    muteBtn.textContent = '🔊';
    holdBtn.textContent = '⏸️';

    console.log('📵 Call ended');
}

// ─────────────────────────────────────────────
// Mute / Hold
// ─────────────────────────────────────────────

function toggleMute() {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    isMuted = !isMuted;
    audioTracks.forEach(track => {
        track.enabled = !isMuted;
    });

    muteBtn.textContent = isMuted ? '🔇' : '🔊';
}

function toggleHold() {
    if (!currentCall) return;

    isHeld = !isHeld;

    const audioTracks = localStream.getAudioTracks();
    if (isHeld) {
        audioTracks.forEach(track => track.enabled = false);
        holdBtn.textContent = '▶️';
        statusMessage.textContent = '(On Hold)';
    } else {
        audioTracks.forEach(track => track.enabled = true);
        holdBtn.textContent = '⏸️';
        statusMessage.textContent = '';
    }
}

// ─────────────────────────────────────────────
// Recording — FIX #2 (mix both streams) + FIX #6 (audio track check)
// ─────────────────────────────────────────────

function toggleRecording() {
    // FIX #6 — check audio tracks exist
    if (!remoteStream || remoteStream.getAudioTracks().length === 0) {
        alert('Audio not ready yet, try again in a moment');
        return;
    }

    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!remoteStream || remoteStream.getAudioTracks().length === 0) {
        alert('No audio stream available');
        return;
    }

    recordedChunks = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

    // FIX #2 — mix local + remote so both sides are recorded
    let streamToRecord;
    try {
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        if (localStream) {
            const localSource = audioContext.createMediaStreamSource(localStream);
            localSource.connect(destination);
        }

        if (remoteStream) {
            const remoteSource = audioContext.createMediaStreamSource(remoteStream);
            remoteSource.connect(destination);
        }

        streamToRecord = destination.stream;
    } catch (e) {
        console.warn('AudioContext mixing failed, falling back to remoteStream only:', e);
        streamToRecord = remoteStream;
    }

    try {
        mediaRecorder = new MediaRecorder(streamToRecord, { mimeType });
    } catch (e) {
        console.warn('mimeType not supported, using default:', e);
        mediaRecorder = new MediaRecorder(streamToRecord);
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);

        // FIX — actually download the file instead of just logging URL
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('✅ Recording downloaded');
    };

    mediaRecorder.start();
    isRecording = true;
    recordBtn.textContent = '⏹️';
    console.log('🔴 Recording started');
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;
    recordBtn.textContent = '⏺️';
}

// ─────────────────────────────────────────────
// Transfer
// ─────────────────────────────────────────────

function initTransfer() {
    transferModal.classList.remove('hidden');
    updateTransferContacts();
}

function closeTransferModal() {
    transferModal.classList.add('hidden');
}

function updateTransferContacts() {
    transferContacts.innerHTML = '';

    document.querySelectorAll('.user-item').forEach(item => {
        const name = item.querySelector('.user-name')?.textContent || 'Unknown';
        const contactDiv = document.createElement('div');
        contactDiv.className = 'transfer-item';
        contactDiv.textContent = name;
        contactDiv.onclick = () => {
            console.log('🔄 Transferring call to', name);
            closeTransferModal();
            statusMessage.textContent = `(Transferring to ${name})`;
        };
        transferContacts.appendChild(contactDiv);
    });
}

// ─────────────────────────────────────────────
// Call Timer
// ─────────────────────────────────────────────

function startCallTimer() {
    callTimer.classList.remove('hidden');
    callTimerInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        callTimer.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callTimer.classList.add('hidden');
    callTimer.textContent = '00:00';
}

// ─────────────────────────────────────────────
// Stats Monitoring — FIX #1 (bandwidth calculation)
// ─────────────────────────────────────────────

let lastBytesReceived = 0;
let lastStatsTime = null;

async function startStatsMonitoring() {
    if (statsInterval) clearInterval(statsInterval);

    lastBytesReceived = 0;
    lastStatsTime = Date.now();

    statsInterval = setInterval(async () => {
        if (!peerConnection) return;

        try {
            const stats = await peerConnection.getStats();
            let latency = 0;
            let packetLoss = 0;
            let jitter = 0;
            let bandwidth = 0;

            const now = Date.now();
            const elapsed = (now - lastStatsTime) / 1000; // seconds since last check

            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    if (report.packetsReceived > 0) {
                        packetLoss = ((report.packetsLost / report.packetsReceived) * 100).toFixed(2);
                        jitter = (report.jitter * 1000).toFixed(2);
                    }

                    // FIX #1 — calculate bandwidth using delta bytes over elapsed time
                    const bytesDelta = report.bytesReceived - lastBytesReceived;
                    bandwidth = ((bytesDelta / elapsed) / 1024).toFixed(2); // KB/s
                    lastBytesReceived = report.bytesReceived;
                }

                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    latency = (report.currentRoundTripTime * 1000).toFixed(2);
                }
            });

            lastStatsTime = now;

            updateStatsDisplay({ latency, packetLoss, jitter, bandwidth });

            socket.emit('call-stats', {
                callId: currentCall,
                stats: {
                    latency: parseFloat(latency),
                    packetLoss: parseFloat(packetLoss),
                    bandwidth: parseFloat(bandwidth),
                    jitter: parseFloat(jitter)
                }
            });

        } catch (error) {
            console.error('Error getting stats:', error);
        }
    }, 1000);
}

function updateStatsDisplay(stats) {
    latencyStat.textContent = `${stats.latency} ms`;
    packetLossStat.textContent = `${stats.packetLoss} %`;
    jitterStat.textContent = `${stats.jitter} ms`;
    bandwidthStat.textContent = `${stats.bandwidth} Kbps`;
}

function resetStats() {
    latencyStat.textContent = '-- ms';
    packetLossStat.textContent = '-- %';
    jitterStat.textContent = '-- ms';
    bandwidthStat.textContent = '-- Kbps';
}

function stopStatsMonitoring() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
    lastBytesReceived = 0;
    lastStatsTime = null;
}

// ─────────────────────────────────────────────
// Call History
// ─────────────────────────────────────────────

function saveCallHistory() {
    localStorage.setItem('callHistory', JSON.stringify(callHistory));
}

function loadCallHistory() {
    const stored = localStorage.getItem('callHistory');
    callHistory = stored ? JSON.parse(stored) : [];
    updateCallHistoryDisplay();
}

function updateCallHistoryDisplay() {
    callHistory_.innerHTML = '';

    if (callHistory.length === 0) {
        callHistory_.innerHTML = '<p style="color: #999; text-align: center;">No call history</p>';
        return;
    }

    callHistory.slice().reverse().forEach(call => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const date = new Date(call.timestamp);
        const timeStr = date.toLocaleTimeString();
        const mins = Math.floor(call.duration / 60);
        const secs = call.duration % 60;

        item.innerHTML = `
            <div class="history-info">
                <div class="history-name">${call.type === 'incoming' ? '📥' : '📤'} ${call.number}</div>
                <div class="history-time">${date.toLocaleDateString()} ${timeStr}</div>
            </div>
            <div class="history-duration">${mins}:${secs.toString().padStart(2, '0')}</div>
        `;
        callHistory_.appendChild(item);
    });
}

function clearHistory() {
    if (confirm('Clear all call history?')) {
        callHistory = [];
        saveCallHistory();
        updateCallHistoryDisplay();
    }
}

// ─────────────────────────────────────────────
// Voicemail
// ─────────────────────────────────────────────

function updateVoicemailDisplay() {
    voicemailCount.textContent = voicemail.length;
    voicemailList.innerHTML = '';

    if (voicemail.length === 0) {
        voicemailList.innerHTML = '<p style="color: #999; text-align: center; padding: 10px;">No voicemails</p>';
        return;
    }

    voicemail.forEach((msg, idx) => {
        const item = document.createElement('div');
        item.className = 'voicemail-item';
        item.innerHTML = `
            <span>${msg.from}</span>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 10px; margin: 0;"
                onclick="deleteVoicemail(${idx})">Delete</button>
        `;
        voicemailList.appendChild(item);
    });
}

function deleteVoicemail(idx) {
    voicemail.splice(idx, 1);
    updateVoicemailDisplay();
}

// ─────────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────────
console.log('🚀 VoIP System loaded (Fixed Version)');