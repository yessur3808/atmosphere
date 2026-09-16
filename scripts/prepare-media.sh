#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
audio_root="$project_root/public/assets/audio"
poster_root="$project_root/public/assets/videos/posters"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

mkdir -p "$audio_root/cat_window" "$audio_root/leaves" "$audio_root/library" "$poster_root"

download() {
  local url="$1"
  local destination="$2"
  curl --fail --location --silent --show-error --retry 3 --retry-delay 2 "$url" -o "$destination"
}

ensure_ffmpeg() {
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ffmpeg is required to prepare licensed audio assets." >&2
    exit 1
  fi
}

if [[ ! -s "$audio_root/leaves/01-canopy-rustle.mp3" ]]; then
  ensure_ffmpeg
  download "https://cdn.freesound.org/previews/403/403051_338690-hq.mp3" "$work_dir/leaves.mp3"
  ffmpeg -hide_banner -loglevel error -y -i "$work_dir/leaves.mp3" \
    -af "loudnorm=I=-20:TP=-1.5:LRA=11,afade=t=in:d=0.5,afade=t=out:st=59.5:d=0.5" \
    -t 60 -ar 44100 -ac 2 -b:a 160k "$audio_root/leaves/01-canopy-rustle.mp3"
fi

if [[ ! -s "$audio_root/cat_window/01-sleepy-purr.mp3" ]]; then
  ensure_ffmpeg
  download "https://cdn.freesound.org/previews/690/690620_6763475-hq.mp3" "$work_dir/cat-purr.mp3"
  ffmpeg -hide_banner -loglevel error -y -i "$work_dir/cat-purr.mp3" \
    -af "loudnorm=I=-20:TP=-1.5:LRA=11,afade=t=in:d=0.5,afade=t=out:st=59.5:d=0.5" \
    -t 60 -ar 44100 -ac 2 -b:a 192k "$audio_root/cat_window/01-sleepy-purr.mp3"
fi

if [[ ! -s "$audio_root/library/01-turning-pages.mp3" ]]; then
  ensure_ffmpeg
  download "https://cdn.freesound.org/previews/151/151221_140737-hq.mp3" "$work_dir/page-turn.mp3"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "anullsrc=r=44100:cl=stereo:d=60" \
    -i "$work_dir/page-turn.mp3" \
    -filter_complex "[1:a]asplit=5[p1][p2][p3][p4][p5];[p1]adelay=5000|5000[a1];[p2]adelay=17000|17000[a2];[p3]adelay=29000|29000[a3];[p4]adelay=41000|41000[a4];[p5]adelay=53000|53000[a5];[0:a][a1][a2][a3][a4][a5]amix=inputs=6:duration=first:normalize=0,alimiter=limit=0.9[out]" \
    -map "[out]" -t 60 -ar 44100 -ac 2 -b:a 192k "$audio_root/library/01-turning-pages.mp3"
fi

while IFS=$'\t' read -r filename url; do
  if [[ ! -s "$poster_root/$filename" ]]; then
    download "$url" "$poster_root/$filename"
  fi
done <<'POSTERS'
onsen.jpg	https://cdn.coverr.co/videos/coverr-steam-from-the-hot-springs-3057/thumbnail?width=1280
cat-window.jpg	https://cdn.coverr.co/videos/coverr-a-red-cat-in-a-fabric-pet-house-6867/thumbnail?width=1280
quiet-library.jpg	https://cdn.coverr.co/videos/user-ai-generation-WwpWQ28vsOsU/thumbnail?width=1280
forest.jpg	https://cdn.coverr.co/videos/coverr-trees-covered-in-moss-7783/thumbnail?width=1280
jungle.jpg	https://cdn.coverr.co/videos/coverr-footpath-in-the-rainforest-9968/thumbnail?width=1280
beach-shore.jpg	https://cdn.coverr.co/videos/coverr-waves-on-the-shore-807/thumbnail?width=1280
traffic.jpg	https://cdn.coverr.co/videos/coverr-cars-in-the-city-at-night-5837/thumbnail?width=1280
POSTERS

echo "Licensed media is ready."
