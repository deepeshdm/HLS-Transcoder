
<h2> HLS and Adaptive HLS Streaming Backend </h2>

A Node.js backend utilizing FFmpeg to process videos into HLS and Adaptive Bitrate Streaming formats. Includes APIs for video conversion, storage, and serving HLS playlists and segments, ensuring smooth and adaptive streaming based on network conditions.

## Setup Locally 👩‍🔧

1. Git clone the project repository on your local system
```javascipt
git clone https://github.com/deepeshdm/HugOrShrug.git
```

2. Install dependencies in package.json
```javascipt
cd HLS_transcoder
npm install
```

3. Download FFMPEG software on your local machine & find path of installation
```javascipt
// MacOS
brew install ffmpeg
which ffmpeg

// LINUX
sudo apt update
sudo apt install ffmpeg
which ffmpeg
```

4. Inside Index.js set the above found path to FFMPEG_PATH, also set HOST variable to where your backend will be hosted, this path is used in segment playlists.
```javascipt
const HOST = 'http://localhost'
const PORT = 3000;
const FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg';  // Locally installed ffmpeg application path
```

5. Setup Frontend (OPTIONAL) - https://github.com/deepeshdm/StreamPlus.git
