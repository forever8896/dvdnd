#!/usr/bin/env bash
# Landing film v2: generate the AI keyframe stills (K1, K2, K5–K12) with fal.ai.
# The globe keyframes (K3, K4) are rendered by scripts/film/globe instead.
#
#   scripts/film/v2-keyframes.sh            generate every missing keyframe
#   scripts/film/v2-keyframes.sh k6 k7      regenerate only these
#
# Cost at fal.py's prices: 7 stills x $0.06 + 3 edits x $0.04 ≈ $0.54 per full pass.
# Needs FAL_KEY in .env (repo root).
set -euo pipefail
cd "$(dirname "$0")/../.."
FAL="python3 -I scripts/film/fal.py"
OUT=design/film/v2/kf
mkdir -p "$OUT"

LOOK="Cinematic film still, shot on 35mm anamorphic, shallow depth of field, gentle film grain, natural color grading, photorealistic. No text, no logos, no signage, no flags, no watermarks, no currency."

prompt_for() {
  case "$1" in
    k1) echo "Argentine pampa at sunrise, wide shot. A low golden sun just above the flat horizon, soft mist over long grass. A herd of red-and-white Hereford and black Angus cattle grazing in the mid-ground. In the foreground a lone gaucho in a wide-brimmed hat and poncho stands in silhouette, seen from behind, facing the rising sun. Sky graded amber, rose and pale blue, long shadows, anamorphic lens flare. $LOOK" ;;
    k2) echo "Keep this exact scene, light, gaucho and cattle. Move the camera to a close shot just behind the gaucho's shoulder and hat brim, looking past him toward the rising sun flaring over the pampa, the cattle soft and out of focus in the distance. Keep him a silhouette, face not visible. $LOOK" ;;
    k5) echo "Interior of a mid-size precision manufacturing plant in China at dusk. Close shot: a worker's gloved hands holding and inspecting a freshly machined aluminium part. CNC machines softly out of focus behind, warm sodium-orange work lights, a little haze in the air, cool blue dusk through high windows. Face not visible. $LOOK" ;;
    k6) echo "Lower Manhattan financial district at blue hour. A well-dressed Black investor in a dark wool overcoat walks away from camera down a narrow street between tall stone neoclassical facades, phone in hand, steam rising from a street grate, warm windows and cool blue sky. Seen from behind, face not visible. $LOOK" ;;
    k7) echo "Interior of a private family office high in a Riyadh tower at golden hour. Floor-to-ceiling windows over the city skyline in warm haze. A man in a white thobe and ghutra seen from behind, seated at a sleek dark desk, holding a tablet that shows an abstract rising line chart with no readable numbers. Minimal, refined, warm gold light. $LOOK" ;;
    k8) echo "Interior of a pension fund office in a historic stone building in Ottawa in winter. Tall arched windows with heavy snow falling outside, warm wood panelling and brass lamps. A portfolio manager in a navy suit seen from behind at a desk, reviewing abstract allocation charts on two monitors with no readable text. Cool white snow light against warm interior light. $LOOK" ;;
    k9) echo "Macro shot in a metal fabrication shop: a glowing orange-hot steel part emerging from a forming press, bright sparks arcing through the air, dark steel-blue background, heat shimmer. Industrial, dramatic, high contrast. $LOOK" ;;
    k10) echo "Keep this exact steel part and its shape. Show it fully cooled to bare steel, resting on a worn steel workbench in calm slate-blue daylight from a high window, a few tools softly out of focus, the shop quiet. $LOOK" ;;
    k11) echo "A woman at a walnut desk in a family-office investment firm, seen over her shoulder from behind. Leather-bound ledgers, printed portfolio statements with abstract unreadable charts, a fountain pen, a brass desk lamp. Large window with a softly blurred city view in calm slate-blue morning light with warm lamp highlights. Face not visible. $LOOK" ;;
    # k12 omits \$LOOK: fal's edit endpoint rejects it with a 422 on this image.
    k12) echo "Keep this exact desk, papers, lamp and lighting. Move to a close-up of her hands resting on the printed portfolio statements, holding the fountain pen. All numbers and charts stay abstract and unreadable. Shallow depth of field, slate-blue light with warm lamp highlights." ;;
  esac
}

# Keyframes made by editing an earlier one, so light and subject stay continuous.
edit_from() {
  case "$1" in
    k2) echo k1 ;;
    k10) echo k9 ;;
    k12) echo k11 ;;
    *) echo "" ;;
  esac
}

ORDER=(k1 k2 k5 k6 k7 k8 k9 k10 k11 k12)
if [ $# -gt 0 ]; then WANT=("$@"); else WANT=("${ORDER[@]}"); fi
for k in "${ORDER[@]}"; do
  [[ " ${WANT[*]} " == *" $k "* ]] || continue
  out="$OUT/$k.jpg"
  if [ $# -eq 0 ] && [ -f "$out" ]; then echo "skip $k (exists)"; continue; fi
  base=$(edit_from "$k")
  if [ -n "$base" ]; then
    src="$OUT/$base.jpg"
    [ -f "$src" ] || { echo "need $src before $k"; exit 1; }
    echo "edit $k from $base"; $FAL edit "$src" "$(prompt_for "$k")" "$out"
  else
    echo "image $k"; $FAL image "$(prompt_for "$k")" "$out" 16:9
  fi
done
