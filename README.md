# SCALE Closed Captioning

A real-time, highly accessible live closed captioning system built for the **SCALE (Southern California Linux Expo)** conference. Designed specifically for attendees who are deaf or hard-of-hearing, the application provides low-latency, readable, and customizable live subtitles on mobile devices, tablets, and desktop browsers.

---

## Key Features & Accessibility (a11y)

- **Accessible Typography & Sizing:** Clean, high-legibility sans-serif font stack using natural sentence casing (no forced all-caps). Fully responsive font size controls (`−`, `+`, `Reset`) that scale both captions and informational status messages.
- **Modern Subtitle Cards:** The latest spoken sentence is highlighted in an elevated active card with an accent border and `● LIVE` badge, accompanied by up to 50 entries of contextual history with subtle timestamps.
- **Triple-Coded Status Indicator:** Live stream status is dual-coded with geometric shapes, adaptive colors, and textual labels for immediate glanceability:
  - `● Live` (Solid pulsing disc)
  - `○ Listening` (Hollow ring when speaker is paused)
  - `! Reconnecting` (Exclamation mark on connection drop)
- **Color Vision Deficiency (CVD) Profiles:** Choose your preferred vision profile from the **`⚙ Settings`** menu:
  - **Standard:** Default dark slate OLED palette with cyan highlights.
  - **Protanopia / Deuteranopia (Red-Green Safe):** Utilizes Wong/IBM colorblind-safe palettes (Sky Blue, Amber, and Rose).
  - **Tritanopia (Blue-Yellow Safe):** Utilizes Mint Emerald, Silver, and Crimson.
  - **Achromatopsia (High-Contrast Grayscale):** Pure luminance differentiation with textured borders.
  - **High Contrast (Broadcast Yellow on Black):** High-luminance EIA-608 broadcast style ($>19:1$ contrast ratio).
- **Developer Debug Mode:** Subtle setting to enable/disable the virtual `TEST` conference room without cluttering live production attendee lists.

---

## Architecture Overview

```
[ RTSP Audio Stream ] ──> [ GStreamer / AWS Transcribe ] ──> [ ZeroMQ PUB :4040 ]
                                                                     │
                                                                     ▼
                                                          [ scale_av_cc.rectifier ]
                                                          (Aggregates stream sentences)
                                                                     │
                                                                     ▼
[ Mobile / Desktop Browser ] <── [ Flask Web API :8000 ] <── [ ZeroMQ REP :4050 ]
```

1. **Audio Pipeline (`bin/run-pipeline`):** Captures RTSP audio feeds per room, streams through an audio transcriber, and publishes text tokens over ZeroMQ PUB.
2. **Rectifier Daemon (`scale_av_cc/rectifier.py`):** Subscribes to configured room channels on port `4040`, aggregates word fragments into completed sentences, and answers latest-caption queries on port `4050`.
3. **Web Server & UI (`scale_av_cc/app.py` & `www/`):** Serves the accessible web interface and provides `/room/<room_id>/latest` JSON endpoints.

---

## Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ (for frontend tests / Cordova)

### 1. Clone the Repository
```bash
git clone https://github.com/DavidMWu/ScaleCC_Cordova.git
cd ScaleCC_Cordova
```

### 2. Setup Python Virtual Environment
Using `venv`:
```bash
python3 -m venv .venv
source .venv/bin/activate       # On Linux / macOS
# or: .venv\Scripts\activate    # On Windows
```

Or using [`uv`](https://github.com/astral-sh/uv):
```bash
uv venv .venv
uv pip install -r requirements-dev.txt
```

### 3. Install Dependencies
```bash
pip install -r requirements-dev.txt
```

---

## Running Locally

### Step 1: Start the Caption Rectifier Daemon
In a dedicated terminal:
```bash
python -m scale_av_cc.rectifier
```
*Listens on `tcp://127.0.0.1:4040` (SUB) and `tcp://127.0.0.1:4050` (REP).*

### Step 2: Start the Web Application
In a second terminal:
```bash
python -m flask --app scale_av_cc.app run --port 8000
```
Open **`http://127.0.0.1:8000/`** in your web browser.

### Step 3: Run the Simulated Test Source
In a third terminal, stream simulated real-time speech into the `test` room:
```bash
python -m scale_av_cc.test_source --room test --interval 2.0 --word-delay 0.2
```
Select **TEST** in the web interface dropdown to view live captions streaming in real time.

---

## Running Unit Tests

Both the frontend and backend are covered by comprehensive unit tests:

### Backend Tests (Python / pytest)
Runs 22 unit tests verifying routes, ZeroMQ communication, input sanitization, error recovery, token generation, and stream pipeline logic:
```bash
pytest
```

### Frontend Tests (Node.js Test Runner)
Runs 8 unit tests verifying room slug transformation, deep history retention, caption DOM construction, XSS prevention, font scaling, color blindness profiles, and debug mode behavior:
```bash
npm test
# or: node --test tests/test_frontend.test.js
```

---

## Configuring AWS Transcribe Credentials

When running the live audio capture pipeline ([bin/run-pipeline](file:///c:/Users/David/Documents/Software%20Projects/Scale%20Closed%20Captions/bin/run-pipeline)), the `awstranscriber` GStreamer element requires valid AWS credentials with permissions to call `transcribe:StartStreamTranscription`.

You can configure your AWS credentials using any of the following standard options:

### Option 1: Local `.env` File (Recommended for Local Testing)
Copy the provided `.env.example` file to `.env` in the repository root:
```bash
cp .env.example .env
```
Edit `.env` and fill in your keys:
```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_DEFAULT_REGION=us-west-2
```
`bin/run-pipeline` automatically detects and sources `.env` when executed. `.env` is ignored by git to protect your keys from being committed.

### Option 2: Standard AWS Credentials File (`~/.aws/credentials`)
If you use the AWS CLI, run `aws configure`, or create `~/.aws/credentials`:
```ini
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```
and `~/.aws/config`:
```ini
[default]
region = us-west-2
```
The GStreamer AWS Transcribe plugin will automatically discover credentials in this default location.

### Option 3: Shell Environment Variables
Export the credentials directly in your terminal session or `.bashrc`:
```bash
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
export AWS_DEFAULT_REGION="us-west-2"
```

### Option 4: IAM Instance Roles (Recommended for Cloud Deployments)
When running on AWS (EC2 / ECS / EKS), attach an IAM instance profile or execution role with `AmazonTranscribeStreamingFullAccess`. The pipeline will automatically fetch temporary STS credentials without storing access keys on the host filesystem.

---

## Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SCALECC_PUBLISH_ADDRESS` | `tcp://127.0.0.1:4040` | ZeroMQ address for audio pipeline speech publishers |
| `SCALECC_REQUEST_ADDRESS` | `tcp://127.0.0.1:4050` | ZeroMQ address for web API room queries |
| `AWS_ACCESS_KEY_ID` | *(Optional)* | AWS credentials for cloud transcription services |
| `AWS_SECRET_ACCESS_KEY` | *(Optional)* | AWS secret for cloud transcription services |
| `AWS_DEFAULT_REGION` | `us-west-2` | AWS region for Transcribe streaming endpoint |

---

## License

[MIT](LICENSE)
