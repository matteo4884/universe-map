/** True when the browser can create a WebGL context */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * True when WebGL runs on the CPU (no GPU acceleration: SwiftShader, llvmpipe,
 * Microsoft's basic renderer). Heavy one-off renders are scaled down there.
 */
export function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
}
