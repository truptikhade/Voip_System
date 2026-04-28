# VoIP Phone System

An enterprise-grade browser-based VoIP system with WebRTC peer-to-peer connections and comprehensive call management features. Connect users with a dial pad, track call history, record conversations, and monitor real-time call quality.

## Key Features

**VoIP Capabilities:**
- Real-time peer-to-peer voice calls using WebRTC
- Professional dial pad for entering phone numbers
- User-friendly contact list
- Call history with duration tracking
- Call recording capability
- Call transfer between users
- Call hold/resume
- Call queue management

**Advanced Monitoring:**
- Real-time call quality statistics
- **Latency**: Round-trip time in milliseconds
- **Packet Loss**: Percentage of lost packets
- **Jitter**: Variability in packet arrival times
- **Bandwidth**: Real-time bandwidth usage in Kbps
- Live call timer

**Professional Interface:**
- Responsive modern UI with gradient design
- Three-panel layout (dial pad, call area, stats)
- Real-time status indicators
- Call queue badge
- Voicemail count
- Mobile-friendly design

## Technology Stack

**Backend:**
- Node.js with TypeScript
- Express.js for HTTP server
- Socket.io for real-time signaling
- CORS support for cross-origin requests

**Frontend:**
- HTML5 with semantic markup
- CSS3 with responsive grid layout
- Vanilla JavaScript (no frameworks)
- WebRTC API for peer connections
- MediaRecorder API for call recording
- Socket.io client for signaling

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Modern web browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- Microphone access (required for voice calls)

## Installation

```bash
# Clone or navigate to project directory
cd calling-platform

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Development

### Start Development Server

```bash
npm run dev
```

The VoIP system will be available at `http://localhost:3000`

### Available Scripts

```bash
npm run dev              # Run in development mode with hot reload
npm run build            # Build TypeScript to JavaScript
npm run build:watch      # Watch mode for continuous compilation
npm run start            # Run production build
npm run lint             # Check code quality
npm run lint:fix         # Fix linting issues automatically
npm test                 # Run test suite
npm test:watch           # Run tests in watch mode
```

## Usage

### Step 1: Launch and Login
1. Open http://localhost:4000 in browser
2. Enter your name and optional phone number
3. Click "Login"
4. Grant microphone permission

### Step 2: Make a Call
**Option A: Using Dial Pad**
1. Click keypad numbers to enter phone number
2. Click "Call" button
3. Wait for recipient to answer

**Option B: Using Contacts**
1. View available users in left panel
2. Click "📞" button next to contact
3. Wait for recipient to answer

### Step 3: During Call
- **Mute**: Click "🔊" to toggle
- **Record**: Click "⏺️" to start/stop recording
- **Transfer**: Click "↔️" to transfer to another user
- **Hold**: Click "⏸️" to pause/resume
- **Monitor**: View real-time stats on right panel
- **Timer**: See call duration in center

### Step 4: End Call
Click red "End Call" button to disconnect

### Step 5: Check History
Scroll down to see:
- Call history with timestamps and duration
- Voicemail messages received
- Queued calls

## Project Structure

```
calling-platform/
├── src/
│   └── index.ts              # Express server + Socket.io signaling
├── public/
│   ├── index.html            # VoIP interface
│   ├── voip-app.js           # Client-side logic
│   └── styles.css            # Professional styling
├── dist/                     # Compiled JavaScript (generated)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .eslintrc.json            # Code quality rules
├── jest.config.js            # Test configuration
├── README.md                 # This file
├── VOIP_FEATURES.md          # Detailed VoIP features guide
├── QUICKSTART.md             # Quick setup guide
└── TESTING.md                # Testing scenarios
```

---

## VoIP Features

### Dial Pad
- Traditional phone keypad (0-9, *, #)
- Letter mappings (ABC, DEF, GHI, etc.)
- Real-time number display
- Clear and backspace buttons

### Call History
- Automatic tracking of all calls
- Duration in MM:SS format
- Incoming and outgoing indicators
- Date and time stamps
- Clear all history option

### Call Timer
- Real-time MM:SS counter
- Auto-starts on connection
- Auto-stops on disconnect
- Large, easy-to-read display

### Call Recording
- One-click start/stop
- WebM audio format
- Auto-download
- Perfect for compliance/documentation

### Voicemail
- Send incoming calls to voicemail
- View voicemail count badge
- List of voicemail messages
- Delete individual messages

### Call Transfer
- Transfer to other online users
- Modal contact selector
- Seamless handoff
- Status indicator

### Call Hold
- Pause current call
- Audio muted while on hold
- Resume capability
- Status shown in UI

### Call Queue
- Automatic queuing of incoming calls
- Queue count badge
- Priority-based handling
- Real-time updates

### Statistics Dashboard
Monitor network performance in real-time:
```
Latency:      Network delay (good: <50ms)
Packet Loss:  Dropped packets (good: 0%)
Jitter:       Delay variability (good: <20ms)
Bandwidth:    Data rate (typical: 20-50 Kbps)
```

---

## API Endpoints

### REST Endpoints
```
GET /api/health           # Health check
GET /api/users            # List all active users with phone numbers
```

### Socket.io Events

**Client → Server:**
- `register` - Register user with name and phone number
- `call-user` - Initiate call with offer
- `call-answer` - Answer call with answer
- `ice-candidate` - Send ICE candidate
- `call-stats` - Send call quality statistics
- `end-call` - End active call
- `reject-call` - Reject incoming call

**Server → Client:**
- `users-updated` - Updated list of online users
- `incoming-call` - Incoming call notification
- `call-answered` - Call was accepted
- `call-rejected` - Call was rejected
- `call-ended` - Call terminated
- `ice-candidate` - ICE candidate for connection
- `stats-updated` - Call quality stats broadcast

## Browser Compatibility

| Browser | Support | Features |
|---------|---------|----------|
| Chrome  |  Full | All features |
| Firefox |  Full | All features |
| Safari  |  Full | iOS 14.5+ |
| Edge    |  Full | All features |
| Opera   |  Full | All features |

---

## Documentation

- **[VOIP_FEATURES.md](VOIP_FEATURES.md)** - Comprehensive VoIP features guide
- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute setup and usage
- **[TESTING.md](TESTING.md)** - Testing scenarios and troubleshooting

---

## Call Quality Guidelines

**Excellent (< 50ms latency, 0% loss):**
- Crystal clear audio
- No noticeable delay
- Professional quality

**Good (50-100ms latency, <1% loss):**
- Clear audio
- Minimal delay
- Suitable for business

**Acceptable (100-200ms latency, 1-3% loss):**
- Usable audio
- Some latency
- Marginal for conferencing

**Poor (> 200ms latency, > 3% loss):**
- Degraded quality
- Noticeable delay/echo
- Consider network upgrade

---

## Performance Tips

1. **Test Connection**: Use stats dashboard to monitor
2. **Network**: Use wired connection for stability
3. **Bandwidth**: Close other apps
4. **Distance**: Stay close to WiFi router
5. **Recording**: Test before important calls
6. **History**: Check call history regularly

---

## Development Guidelines

- Use TypeScript for type safety
- Follow ESLint rules: `npm run lint:fix`
- Write tests for new features
- Keep components modular
- Test on multiple browsers
- Monitor call quality stats

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Microphone not working | Check browser permissions and system settings |
| Can't see users | Refresh page or check server is running |
| No audio in call | Verify microphone input and speaker output |
| Poor call quality | Check internet speed and close other apps |
| Recording not working | Verify browser supports MediaRecorder API |
| Transfer fails | Ensure target user is online |
| Stats not updating | Check WebRTC connection status |

---

## Security Considerations

**Current Demo Implementation:**
- Uses HTTP (not HTTPS)
- No user authentication
- Local-only storage (no encryption)
- No persistent backend storage

**For Production Deployment:**
- Enable HTTPS/WSS encryption
- Implement user authentication
- Add database for history
- Encrypt all recordings
- Enable rate limiting
- Validate all inputs
- Implement access controls

---

## Deployment

### Quick Deployment Options

**Heroku:**
```bash
git push heroku main
```

**Railway:**
1. Connect GitHub repo
2. Deploy automatically

**Docker:**
```bash
docker build -t voip-system .
docker run -p 4000:4000 voip-system
```

---

## License

ISC

---

**Ready to make calls? Launch with `npm run dev`!**

