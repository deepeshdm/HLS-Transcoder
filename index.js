const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const app = express();
app.use(cors()); 

const HOST = 'http://localhost' // host url (will be added to hls segment paths)
const PORT = 3000;

// Locally installed ffmpeg application path (macOs)
const FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg';
ffmpeg.setFfmpegPath(FFMPEG_PATH);

// Set up multer for file uploads. Save uploaded files to 'uploads' folder
const upload = multer({ dest: 'uploads/' });

// Define the resolutions for transcoding
const resolutions = [

  { width: 426, height: 240, name: '240p' },
  { width: 640, height: 360, name: '360p' },
  { width: 1280, height: 720, name: '720p' },
  { width: 1920, height: 1080, name: '1080p' }
];

// Serve the output directory (to serve .m3u8 and .ts files)
app.use('/output', express.static(path.join(__dirname, 'output')));

// NON-ADAPTIVE HLS - Upload a video and process it into HLS segments for multiple resolutions.
// This endpoint does'nt generate a single master playlist. Rather multiple playlists, 1 for each resolution.
app.post('/upload', upload.single('video'), async (req, res) => {
  const videoFile = req.file;

  if (!videoFile) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const videoPath = path.join(__dirname, videoFile.path);
  const outputDir = path.join(__dirname, 'output', videoFile.filename);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Initialize an array to hold the HLS playlist paths for different resolutions
  const hlsStreams = [];

  // Use `map` to handle async operations and wait for them with Promise.all
  try {
    const transcodingPromises = resolutions.map(async (res) => {
      const resolutionDir = path.join(outputDir, res.name);
      const hlsOutputPath = path.join(resolutionDir, 'index.m3u8'); // HLS playlist file path for each resolution

      // Make sure the resolution directory exists
      if (!fs.existsSync(resolutionDir)) {
        fs.mkdirSync(resolutionDir, { recursive: true });
      }

      // Transcode video to HLS format for this resolution
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([
            `-vf scale=${res.width}:${res.height}`, // Resize video to current resolution
            '-profile:v baseline',
            '-level 3.0',
            '-start_number 0',
            '-hls_time 10',  // Set segment length (in seconds)
            '-hls_list_size 0', // Store all segments in the playlist
            '-f hls'  // Format as HLS
          ])
          .output(hlsOutputPath) // Output to .m3u8 playlist
          .on('end', () => {
            console.log(`Transcoding to ${res.name} finished!`);
            // Add this resolution's stream to the array
            hlsStreams.push({
              resolution: res.name,
              hlsUrl: `${HOST}:${PORT}/output/${videoFile.filename}/${res.name}/index.m3u8`
            });
            resolve(); // Resolve when transcoding for this resolution finishes
          })
          .on('error', (err) => {
            console.error(`Error during transcoding to ${res.name}:`, err);
            reject(err); // Reject on error
          })
          .run();
      });
    });

    // Wait for all transcoding tasks to finish
    await Promise.all(transcodingPromises);
    return res.json({
      message: 'Video transcoded to multiple resolutions and segments created',
      hlsStreams: hlsStreams
    });
  } catch (err) {
    res.status(500).json({ message: 'Error transcoding video', error: err.message });
  }
});

// ADAPTIVE HLS - Upload a video and process it into adaptive HLS segments for multiple resolutions.
app.post('/upload-adaptive', upload.single('video'), async (req, res) => {
    const videoFile = req.file;
  
    if (!videoFile) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
  
    const videoPath = path.join(__dirname, videoFile.path);
    const outputDir = path.join(__dirname, 'output', videoFile.filename);
  
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  
    // Initialize an array to hold the HLS playlist paths for different resolutions
    const hlsStreams = [];
  
    // Use `map` to handle async operations and wait for them with Promise.all
    try {

      const transcodingPromises = resolutions.map(async (res) => {

        const resolutionDir = path.join(outputDir, res.name);
        const hlsOutputPath = path.join(resolutionDir, 'index.m3u8'); // HLS playlist file path for each resolution

        // Make sure the resolution directory exists
        if (!fs.existsSync(resolutionDir)) {
        fs.mkdirSync(resolutionDir, { recursive: true });
        }

        // Transcode video to HLS format for this resolution
        await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .outputOptions([
            `-vf scale=${res.width}:${res.height}`, // Resize video to current resolution
            '-profile:v baseline',
            '-level 3.0',
            '-start_number 0',
            '-hls_time 3',  // Set segment length (in seconds)
            '-hls_list_size 0', // Store all segments in the playlist
            '-f hls'  // Format as HLS
            ])
            .output(hlsOutputPath) // Output to .m3u8 playlist
            .on('end', () => {
                console.log(`Transcoding to ${res.name} finished!`);
                // Add this resolution's stream to the array
                hlsStreams.push({
                    resolution: res.name,
                    hlsUrl: `${HOST}:${PORT}/output/${videoFile.filename}/${res.name}/index.m3u8`
                });
                resolve(); // Resolve when transcoding for this resolution finishes
            })
            .on('error', (err) => {
                console.error(`Error during transcoding to ${res.name}:`, err);
                reject(err); // Reject on error
            })
            .run();
        });

    });
  
    // Wait for all transcoding tasks to finish
    await Promise.all(transcodingPromises);

    // Create the master playlist which contains data about all resolutions
    const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
    let masterPlaylist = '#EXTM3U\n';
    hlsStreams.forEach((stream, index) => {
        const bandwidth = (index + 1) * 1000000;  // Example bandwidth, adjust accordingly
        const resolution = resolutions[index];   // Get resolution width and height
        masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution.width}x${resolution.height}\n`;
        masterPlaylist += `${stream.hlsUrl}\n`;
    });

    // Write the master playlist file
    fs.writeFileSync(masterPlaylistPath, masterPlaylist);

    return res.json({
        message: 'Video transcoded to multiple resolutions and adaptive HLS master playlist created',
        masterPlaylistUrl: `${HOST}:${PORT}/output/${videoFile.filename}/master.m3u8`,
        hlsStreams: hlsStreams
    });

    } catch (err) {
      res.status(500).json({ message: 'Error transcoding video', error: err.message });
    }
  });
  

app.listen(PORT, () => {
  console.log(`Server running at ${HOST}:${PORT}`);
});
