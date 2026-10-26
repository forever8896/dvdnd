#!/usr/bin/env bash
# Landing film v2: assemble the AI transitions and the rendered globe into the two
# scroll films, plus mobile chapter loops, posters and a join contact sheet.
#
#   scripts/film/v2-assemble.sh
#
# Inputs:  design/film/v2/clips/t*.mp4 (v2-transitions.sh), scripts/film/globe/out/globe.mp4
# Outputs: app/public/film/v2/{a,b}.mp4 (all-intra scrub masters), {a,b}-N.mp4 (chapter loops),
#          {a,b}-N.webp (posters), globe-labels.json; design/film/v2/joins.jpg
set -euo pipefail
cd "$(dirname "$0")/../.."
CLIPS=design/film/v2/clips
GLOBE=scripts/film/globe/out
PUB=app/public/film/v2
WORK=design/film/v2/work
mkdir -p "$PUB" "$WORK"
FF="ffmpeg -y -loglevel error"
NORM="scale=1152:648:force_original_aspect_ratio=increase,crop=1152:648,fps=24,setsar=1"

# Normalise one segment. Every segment but a film's last drops its final frame,
# because the next segment starts on that same keyframe.
norm() { # in out keep_last
  local frames; frames=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$1")
  local trim=""; [ "$3" = "drop" ] && trim=",trim=end_frame=$((frames - 1)),setpts=PTS-STARTPTS"
  $FF -i "$1" -vf "$NORM$trim" -an -c:v libx264 -crf 12 -preset fast -pix_fmt yuv420p "$2"
}

norm $CLIPS/t1.mp4  $WORK/a1.mp4 drop
norm $CLIPS/t2.mp4  $WORK/a2.mp4 drop
norm $GLOBE/globe.mp4 $WORK/a3.mp4 drop
norm $CLIPS/t4.mp4  $WORK/a4.mp4 drop
norm $CLIPS/t5.mp4  $WORK/a5.mp4 drop
norm $CLIPS/t6.mp4  $WORK/a6.mp4 drop
norm $CLIPS/t7.mp4  $WORK/a7.mp4 keep
norm $CLIPS/t8.mp4  $WORK/b1.mp4 drop
norm $CLIPS/t9.mp4  $WORK/b2.mp4 drop
norm $CLIPS/t10.mp4 $WORK/b3.mp4 keep

# Concatenate (no dissolves), add a light shared grain so the rendered globe sits with the
# filmed footage, then encode the all-intra scrub master: every frame a keyframe.
film() { # name segments...
  local name=$1; shift
  local inputs=() filter="" i=0
  for s in "$@"; do inputs+=(-i "$WORK/$s.mp4"); filter+="[$i:v]"; i=$((i + 1)); done
  filter+="concat=n=$i:v=1:a=0,noise=alls=4:allf=t[v]"
  $FF "${inputs[@]}" -filter_complex "$filter" -map "[v]" -c:v libx264 -crf 12 -preset fast -pix_fmt yuv420p "$WORK/$name-master.mp4"
  $FF -i "$WORK/$name-master.mp4" -c:v libx264 -crf 28 -preset slow -x264-params keyint=1:scenecut=0 \
    -pix_fmt yuv420p -movflags +faststart -an "$PUB/$name.mp4"
}
film a a1 a2 a3 a4 a5 a6 a7
film b b1 b2 b3

# Segment boundaries in seconds (frames / 24) for the join check and the component timings.
for n in a b; do
  echo "$n: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$PUB/$n.mp4")s"
done

# Mobile chapter loops: palindrome (forward then reversed) so every loop is seamless.
chapter() { # film n start end
  $FF -ss "$3" -to "$4" -i "$WORK/$1-master.mp4" -filter_complex \
    "[0:v]scale=960:540,split[f][r];[r]reverse[rv];[f][rv]concat=n=2:v=1:a=0[v]" -map "[v]" \
    -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an "$PUB/$1-$2.mp4"
}
poster() { # film n time
  $FF -ss "$3" -i "$WORK/$1-master.mp4" -frames:v 1 "$WORK/poster.png"
  magick "$WORK/poster.png" -quality 80 "$PUB/$1-$2.webp"
}
chapter a 1 0     5.0;   poster a 1 0.05
chapter a 2 5.1   10.0;  poster a 2 9.6
chapter a 3 16    22.0;  poster a 3 20.0
chapter a 4 22.1  27.0;  poster a 4 26.5
chapter a 5 31    37.1;  poster a 5 34.0
chapter a 6 37.2  42.1;  poster a 6 41.6
chapter b 1 0     5.0;   poster b 1 1.2
chapter b 2 5.1   10.0;  poster b 2 5.6
chapter b 3 7.6   11.6;  poster b 3 9.8
chapter b 4 11.7  15.1;  poster b 4 14.6

cp $GLOBE/labels.json "$PUB/globe-labels.json"

# Join check: the frame before and after every cut, side by side.
F=/System/Library/Fonts/Supplemental/Arial.ttf
rm -f $WORK/j-*.png
j=0
for spec in "a:5.04" "a:10.08" "a:22.04" "a:27.08" "a:32.13" "a:37.17" "b:5.04" "b:10.08"; do
  n=${spec%%:*}; t=${spec#*:}; j=$((j + 1))
  $FF -ss "$(echo "$t - 0.05" | bc)" -i "$WORK/$n-master.mp4" -frames:v 1 -vf scale=480:-1 "$WORK/j-$j-a.png"
  $FF -ss "$(echo "$t + 0.05" | bc)" -i "$WORK/$n-master.mp4" -frames:v 1 -vf scale=480:-1 "$WORK/j-$j-b.png"
done
magick montage -font $F -pointsize 14 -fill white -label '%t' $WORK/j-*.png -tile 4x -geometry +3+3 -background '#111' design/film/v2/joins.jpg
ls -la "$PUB"
