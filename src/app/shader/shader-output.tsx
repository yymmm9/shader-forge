"use client";

import * as React from "react";

import {
  useToolcraft,
  useToolcraftMediaPresentationUrls,
  useToolcraftPipeline,
  useToolcraftPipelinePass,
  useToolcraftProductSceneFrame,
  useToolcraftViewportInteractionActive,
} from "@/toolcraft/runtime/react";

import { createShaderRenderer, type ShaderRenderer } from "./shader-gl";
import {
  clearShaderMediaRegistry,
  subscribeShaderMediaRegistry,
  syncShaderMediaRegistry,
} from "./shader-media";
import { shaderFramePass, shaderSourceTexturePass } from "./shader-pipeline";
import {
  materializeShaderSource,
  resolveShaderSource,
} from "./shader-source";
import {
  getShaderLoopTime,
  getShaderParams,
  getShaderSourceImageAsset,
  getShaderSourceKind,
  getShaderText,
} from "./shader-state";

import styles from "./shader-output.module.css";

export function ShaderForgeOutput(): React.JSX.Element {
  const { state } = useToolcraft();
  const sceneFrame = useToolcraftProductSceneFrame();
  const pipeline = useToolcraftPipeline();
  const presentationUrls = useToolcraftMediaPresentationUrls(
    state.mediaAssets,
  );
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rendererRef = React.useRef<ShaderRenderer | null>(null);
  const [registryVersion, bumpRegistryVersion] = React.useReducer(
    (version: number) => version + 1,
    0,
  );
  const [surfaceVersion, bumpSurfaceVersion] = React.useReducer(
    (version: number) => version + 1,
    0,
  );

  const interacting = useToolcraftViewportInteractionActive();
  const sourceAsset = getShaderSourceImageAsset(state);
  const params = React.useMemo(() => getShaderParams(state), [state]);
  const loopTime = getShaderLoopTime(state.timeline, params.speed);
  const typographyKey = JSON.stringify(
    state.values["text.typography"] ?? null,
  );

  const sourcePass = useToolcraftPipelinePass(
    shaderSourceTexturePass,
    {
      "source.image": sourceAsset?.id ?? null,
      "source.kind": getShaderSourceKind(state),
      "text.content": getShaderText(state),
      "text.typography": typographyKey,
    },
    async () => resolveShaderSource(state),
  );

  React.useEffect(
    () => subscribeShaderMediaRegistry(bumpRegistryVersion),
    [],
  );
  React.useEffect(() => {
    syncShaderMediaRegistry(
      new Map(
        state.mediaAssets.flatMap((asset) => {
          const url = presentationUrls.get(asset.id);
          return url ? [[asset.id, url] as const] : [];
        }),
      ),
    );
  }, [presentationUrls, state.mediaAssets]);
  React.useEffect(() => clearShaderMediaRegistry, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => bumpSurfaceVersion());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const mountCanvas = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      canvasRef.current = canvas;
      if (!canvas) return;
      rendererRef.current = createShaderRenderer(canvas);
      canvas.dataset.renderer = rendererRef.current?.kind ?? "unavailable";
      bumpSurfaceVersion();
    },
    [],
  );

  React.useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer || sceneFrame.kind !== "ready") return;
      if (interacting) return;
      if (sourcePass.status !== "success") return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const deviceScale =
        (window.devicePixelRatio || 1) *
        (typeof state.values["canvas.renderScale"] === "number"
          ? state.values["canvas.renderScale"]
          : 1);
      canvas.width = Math.max(1, Math.round(rect.width * deviceScale));
      canvas.height = Math.max(1, Math.round(rect.height * deviceScale));
      const { band, source, transform } = await materializeShaderSource(
        sourcePass.result,
      );
      if (cancelled || interacting) return;
      let rendered = true;
      const render = () => {
        rendered =
          renderer.render({
            amount: params.amount,
            band,
            effect: params.effect,
            phase: params.phase,
            scale: params.scale,
            source,
            sourceTransform: transform,
            time: loopTime,
          }) && rendered;
      };
      if (pipeline) {
        await pipeline.runPass(shaderFramePass, undefined, render);
      } else {
        render();
      }
      if (!rendered && !cancelled) {
        canvas.dataset.renderer = "unavailable";
      }
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [
    sceneFrame,
    sourcePass,
    params,
    sourceAsset,
    pipeline,
    state,
    registryVersion,
    surfaceVersion,
    interacting,
    loopTime,
  ]);

  return (
    <canvas
      className={styles.canvas}
      data-toolcraft-product-output="shader-forge"
      ref={mountCanvas}
    />
  );
}
