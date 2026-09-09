import React, { useEffect, useRef } from 'react';

interface TransparentCoinCanvasProps {
  videoSrc: string;
  className?: string;
}

export const TransparentCoinCanvas: React.FC<TransparentCoinCanvasProps> = ({
  videoSrc,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animId: number;
    let gl: WebGLRenderingContext | null = null;
    let fallback2d = false;

    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    } catch {
      gl = null;
    }

    if (!gl) {
      fallback2d = true;
    }

    let program: WebGLProgram | null = null;
    let texture: WebGLTexture | null = null;

    if (gl) {
      // Vertex shader: Map coordinates ONLY to the right half of the source video (where the 3D coins rotate)
      // The left half of the video contains the old mockup text, which is completely excluded.
      const vsSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          // Crop texture x to range [0.50, 1.0] to isolate the coins and eliminate all text
          float coinX = 0.50 + a_texCoord.x * 0.50;
          v_texCoord = vec2(coinX, 1.0 - a_texCoord.y);
        }
      `;

      // Fragment shader with Luma-Keying
      // Removes the dark background so ONLY the floating coins are rendered
      const fsSource = `
        precision mediump float;
        uniform sampler2D u_image;
        varying vec2 v_texCoord;
        void main() {
          // Discard top navbar or bottom frame of the recording
          if (v_texCoord.y > 0.92 || v_texCoord.y < 0.06) {
            discard;
          }

          vec4 color = texture2D(u_image, v_texCoord);
          
          // Calculate brightness
          float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          
          // Luma threshold to eliminate dark video background
          float alpha = smoothstep(0.08, 0.22, luma);
          
          // Softly feather left edge where the crop occurs
          float leftEdgeFade = smoothstep(0.50, 0.54, v_texCoord.x);
          alpha *= leftEdgeFade;
          
          gl_FragColor = vec4(color.rgb, alpha);
        }
      `;

      const createShader = (type: number, source: string) => {
        const shader = gl!.createShader(type);
        if (!shader) return null;
        gl!.shaderSource(shader, source);
        gl!.compileShader(shader);
        if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
          console.warn('Shader compile error:', gl!.getShaderInfoLog(shader));
          gl!.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vs = createShader(gl.VERTEX_SHADER, vsSource);
      const fs = createShader(gl.FRAGMENT_SHADER, fsSource);

      if (vs && fs) {
        program = gl.createProgram();
        if (program) {
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);

          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn('Program link error:', gl.getProgramInfoLog(program));
            fallback2d = true;
          }
        }
      } else {
        fallback2d = true;
      }

      if (!fallback2d && program) {
        gl.useProgram(program);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0,
          ]),
          gl.STATIC_DRAW
        );

        const aPositionLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(aPositionLocation);
        gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
          ]),
          gl.STATIC_DRAW
        );

        const aTexCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        gl.enableVertexAttribArray(aTexCoordLocation);
        gl.vertexAttribPointer(aTexCoordLocation, 2, gl.FLOAT, false, 0, 0);

        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    }

    const ctx2d = fallback2d ? canvas.getContext('2d') : null;

    const render = () => {
      if (video.readyState >= 2) {
        // Source width of the cropped coin section is half the video width
        const coinWidth = Math.floor(video.videoWidth * 0.50);
        const coinHeight = video.videoHeight;

        if (canvas.width !== coinWidth || canvas.height !== coinHeight) {
          if (coinWidth > 0 && coinHeight > 0) {
            canvas.width = coinWidth;
            canvas.height = coinHeight;
            if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
          }
        }

        if (gl && !fallback2d && texture) {
          gl.clearColor(0.0, 0.0, 0.0, 0.0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        } else if (ctx2d) {
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);
          // Draw ONLY the right half of the video (from 50% width to 100% width)
          ctx2d.drawImage(
            video,
            video.videoWidth * 0.50,
            0,
            video.videoWidth * 0.50,
            video.videoHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );
          try {
            const frame = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
            const data = frame.data;
            for (let i = 0; i < data.length; i += 4) {
              const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              if (luma < 25) {
                data[i + 3] = 0;
              } else if (luma < 50) {
                data[i + 3] = ((luma - 25) / 25) * 255;
              }
            }
            ctx2d.putImageData(frame, 0, 0);
          } catch {
            // Ignore cross-origin error
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    video.play().catch(() => {});
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      if (gl && texture) gl.deleteTexture(texture);
      if (gl && program) gl.deleteProgram(program);
    };
  }, [videoSrc]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        crossOrigin="anonymous"
        className="hidden pointer-events-none"
      />

      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain pointer-events-none select-none drop-shadow-[0_0_35px_rgba(0,255,102,0.3)]"
        style={{
          maskImage: 'radial-gradient(ellipse at 50% 50%, black 50%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, black 50%, transparent 75%)'
        }}
      />
    </div>
  );
};

export default TransparentCoinCanvas;
