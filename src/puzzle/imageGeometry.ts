/** Draw in board coordinates even when the delivered image was resized. */
export function drawPuzzleImage(ctx: CanvasRenderingContext2D, image: CanvasImageSource, width: number, height: number, x = 0, y = 0) {
  ctx.drawImage(image, -x, -y, width, height);
}

/** Fit both dimensions, preserving portraits as well as landscapes. */
export function containImage(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}
