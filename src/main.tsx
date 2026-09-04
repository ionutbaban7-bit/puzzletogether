import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// CanvasRenderingContext2D.roundRect is broadly available in current browsers,
// but this small fallback keeps the shared boards usable in older embedded
// workshop browsers as well. The board code only passes a numeric radius.
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRectFallback(x, y, width, height, radii = 0) {
    const radius = typeof radii === "number" ? radii : 0;
    const r = Math.max(0, Math.min(Math.abs(width) / 2, Math.abs(height) / 2, radius));
    this.moveTo(x + r, y);
    this.lineTo(x + width - r, y);
    this.quadraticCurveTo(x + width, y, x + width, y + r);
    this.lineTo(x + width, y + height - r);
    this.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    this.lineTo(x + r, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
