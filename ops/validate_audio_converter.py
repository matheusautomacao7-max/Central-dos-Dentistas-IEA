import subprocess
import sys

sys.path.insert(0, "/app")
import server

source = subprocess.run(
    [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
        "-t", "1", "-c:a", "libopus", "-f", "webm", "pipe:1",
    ],
    stdout=subprocess.PIPE,
    check=True,
).stdout
converted = server.convert_crm_audio_to_ogg(source)
assert converted.startswith(b"OggS")
print("audio-converter-ok", len(source), len(converted))
