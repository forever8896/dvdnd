#!/usr/bin/env bash
# Landing film v2: animate the camera moves between keyframes with fal.ai (Kling, first+last frame).
# Each clip starts exactly on one keyframe and lands exactly on the next, so the cut-free chain holds.
#
#   scripts/film/v2-transitions.sh            generate every missing transition (in parallel)
#   scripts/film/v2-transitions.sh t5 t6      regenerate only these
#
# Cost at fal.py's prices: 9 clips x $0.35 ≈ $3.15 per full pass. Needs FAL_KEY in .env.
set -euo pipefail
cd "$(dirname "$0")/../.."
KF=design/film/v2/kf
GLOBE=scripts/film/globe/out
OUT=design/film/v2/clips
mkdir -p "$OUT"

STYLE="Photorealistic, cinematic, smooth continuous camera move, no cuts, gentle film grain."

# start | end | prompt
spec() {
  case "$1" in
    t1)  echo "$KF/k1.jpg|$KF/k2.jpg|Slow lateral dolly across the grazing herd toward the gaucho, ending close behind his shoulder as the sun flares over the pampa. $STYLE" ;;
    t2)  echo "$KF/k2.jpg|$GLOBE/k3.png|The camera rises steadily from behind the gaucho into the sunrise sky, up through thin clouds and the upper atmosphere, until the curve of the Earth appears and it settles on a view of the whole globe from space. $STYLE" ;;
    t4)  echo "$GLOBE/k4.png|$KF/k5.jpg|The camera dives down from orbit through clouds toward a glowing industrial city at dusk, continuing down through a factory roof and settling inside the plant on gloved hands holding a machined part. $STYLE" ;;
    t5)  echo "$KF/k5.jpg|$KF/k6.jpg|A fast motion-blurred whip-pan away from the factory that resolves on a New York financial-district street at blue hour, an investor walking away from camera. $STYLE" ;;
    t6)  echo "$KF/k6.jpg|$KF/k7.jpg|A fast motion-blurred whip-pan off the New York street that resolves inside a high office overlooking a desert skyline at golden hour. $STYLE" ;;
    t7)  echo "$KF/k7.jpg|$KF/k8.jpg|A fast motion-blurred whip-pan away from the golden skyline that resolves inside a historic stone office with snow falling outside tall windows. $STYLE" ;;
    t8)  echo "$KF/k9.jpg|$KF/k10.jpg|A gloved hand lifts the glowing steel part with tongs; the camera follows it into the cool shop light as it cools from orange to bare steel and comes to rest on a workbench. $STYLE" ;;
    t9)  echo "$KF/k10.jpg|$KF/k11.jpg|The camera glides smoothly up from the workbench and through a doorway into a calm, sunlit family-office room, settling behind a woman at her desk. $STYLE" ;;
    t10) echo "$KF/k11.jpg|$KF/k12.jpg|A slow push-in over the shoulder onto the desk, the papers and the hands holding a fountain pen. $STYLE" ;;
  esac
}

ALL=(t1 t2 t4 t5 t6 t7 t8 t9 t10)
if [ $# -gt 0 ]; then WANT=("$@"); else WANT=("${ALL[@]}"); fi
pids=()
for t in "${WANT[@]}"; do
  out="$OUT/$t.mp4"
  if [ $# -eq 0 ] && [ -f "$out" ]; then echo "skip $t (exists)"; continue; fi
  IFS='|' read -r start end prompt <<< "$(spec "$t")"
  ( python3 -I scripts/film/fal.py flf "$start" "$end" "$prompt" "$out" > "$OUT/$t.log" 2>&1 && echo "done $t" || echo "FAILED $t (see $OUT/$t.log)" ) &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
