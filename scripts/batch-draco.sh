# /home/tuantd/workspace/anki_ar/scripts/batch-draco.sh
#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/tuantd/workspace/anki_ar"
BIN="${ROOT}/node_modules/.bin/gltf-transform"
CSV="${ROOT}/scripts/results-draco.csv"

# Bit-depth có thể override qua env 
QPOS="${QPOS:-14}"
QNORM="${QNORM:-10}"
QTEX="${QTEX:-12}"

# DRY_RUN=1: vẫn chạy nén để đo size, nhưng KHÔNG mv ghi đè
DRY="${DRY_RUN:-0}"

# Header CSV nếu chưa có
if [ ! -f "$CSV" ]; then
  echo "path,before_bytes,after_bytes,saved_bytes,saved_pct,action,qpos, qnorm, qtex, timestamp" > "$CSV"
fi

timestamp() { date +%Y-%m-%dT%H:%M:%S%z; }

find "${ROOT}/data" -type f -iname '*.glb' | while read -r f; do
  # Bỏ qua file trung gian
  if [[ "$f" =~ \.q\.glb$ || "$f" =~ \.tmp\.glb$ ]]; then
    continue
  fi

  qfile="${f%.glb}.q.glb"
  tmp="${f%.glb}.tmp.glb"

  echo -e "\n[Compress] $f"
  # B1: Quantize
  "${BIN}" quantize \
    "$f" "$qfile" \
    --quantize-position "${QPOS}" \
    --quantize-normal "${QNORM}" \
    --quantize-texcoord "${QTEX}"

  # B2: Draco
  "${BIN}" draco \
    "$qfile" "$tmp"

  before=$(stat -c%s "$f")
  after=$(stat -c%s "$tmp" || echo 0)

  action="kept"
  saved=0
  pct=0
  if [ "$after" -gt 0 ] && [ "$after" -lt "$before" ]; then
    saved=$(( before - after ))
    pct=$(( (100 * saved) / before ))
    if [ "$DRY" = "1" ]; then
      echo "DRY_RUN: would replace $before -> $after bytes (~${pct}%)"
      action="dry_replace"
      rm -f "$tmp"
    else
      mv -f "$tmp" "$f"
      echo "OK: $before -> $after bytes (~${pct}%)"
      action="replaced"
    fi
  else
    rm -f "$tmp"
    echo "No gain: giữ nguyên"
    action="no_gain"
  fi

  # Ghi CSV
  printf '%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n' \
    "$f" "$before" "$after" "$saved" "$pct" "$action" "$QPOS" "$QNORM" "$QTEX" "$(timestamp)" >> "$CSV"

  rm -f "$qfile"
done

echo -e "\nCSV written to: $CSV"